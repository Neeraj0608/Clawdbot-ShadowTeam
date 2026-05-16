import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate, authorize, errorRes, successRes } from '@/lib/api-helpers';
import { getStoredFileDisplayName, sanitizeFilename } from '@/lib/innovation';
import { getSignedUrl, uploadFileWithObjectKey } from '@/lib/minio';

// GET /api/profile/me
export async function GET(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'STUDENT')) return errorRes('Forbidden', ['Student access required'], 403);

    console.log('[PROFILE GET] Authenticated User:', user.id, user.email);
    
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return errorRes('Profile not found', ['Student profile does not exist. Please create one first.'], 404);
    }

    const payload = {
      ...profile,
      resumeFileName: getStoredFileDisplayName(profile.resumeUrl),
      resumeUrl: profile.resumeUrl ? await getSignedUrl(profile.resumeUrl).catch(() => null) : null,
    };

    return successRes(payload, 'Profile retrieved successfully.');
  } catch (err) {
    console.error('Profile GET error:', err);
    return errorRes('Internal server error', [], 500);
  }
}

// POST /api/profile
export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'STUDENT')) return errorRes('Forbidden', ['Student access required'], 403);

    const formData = await req.formData();
    const skills = ((formData.get('skills') as string) || '').trim();
    const summary = ((formData.get('summary') as string) || '').trim();
    const resumeFile = formData.get('resume') as File | null;

    let resumeUrl: string | null = null;
    if (resumeFile) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const resumeKey = `profiles/${user.id}/resume-${Date.now()}-${sanitizeFilename(resumeFile.name)}`;
      await uploadFileWithObjectKey(resumeKey, { buffer, mimetype: resumeFile.type, size: buffer.length });
      resumeUrl = resumeKey;
    }

    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: { skills, summary, resumeUrl, updatedAt: new Date() },
      create: { userId: user.id, skills, summary, resumeUrl },
    });

    return successRes(profile, 'Profile updated.', 201);
  } catch (err) {
    return errorRes('Internal server error', [], 500);
  }
}

// PATCH /api/profile
export async function PATCH(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    console.log('[PROFILE PATCH] Authenticated User:', user.id, user.email);
    
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const updateData: any = {};
      
      const fields = [
        'skills', 'experience', 'interests', 'summary', 'internships', 
        'projects', 'education', 'languages', 'certifications', 
        'awards', 'clubs', 'exams', 'employment', 'achievements', 'preferences'
      ];

      fields.forEach(f => {
        if (body[f] !== undefined) {
          // Fallback: If it's preferences, save it to 'interests' field
          if (f === 'preferences') updateData['interests'] = JSON.stringify(body[f]);
          else updateData[f] = body[f];
        }
      });

      console.log('[PROFILE SAVE] Payload:', updateData);

      const updated = await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {
          ...updateData,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          ...updateData,
        }
      });

      return successRes(updated, 'Student profile updated successfully.');
    } else {
      const formData = await req.formData();
      const resumeFile = formData.get('resume') as File | null;
      let resumeUrl: string | undefined;

      if (resumeFile) {
        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        const resumeKey = `profiles/${user.id}/resume-${Date.now()}-${sanitizeFilename(resumeFile.name)}`;
        await uploadFileWithObjectKey(resumeKey, { buffer, mimetype: resumeFile.type, size: buffer.length });
        resumeUrl = resumeKey;
      }

      const updated = await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: {
          ...(resumeUrl && { resumeUrl }),
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          ...(resumeUrl && { resumeUrl }),
        }
      });

      return successRes(updated, 'Profile updated.');
    }
  } catch (err) {
    console.error('Profile PATCH error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
