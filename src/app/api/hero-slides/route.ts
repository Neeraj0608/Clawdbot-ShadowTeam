import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';
import { heroSlideCreateSchema } from '@/lib/validators';
import { uploadFile, getSignedUrl } from '@/lib/minio';

// GET /api/hero-slides — public, used by homepage hero carousel
export async function GET() {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const withUrls = await Promise.all(
      slides.map(async (slide) => ({
        ...slide,
        imageUrl: await getSignedUrl(slide.imageKey).catch(() => null),
      }))
    );

    return successRes(withUrls, 'Hero slides retrieved.');
  } catch (err) {
    console.error('Hero slides list error:', err);
    return errorRes('Internal server error', [], 500);
  }
}

// POST /api/hero-slides — admin only
export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN')) return errorRes('Forbidden. Admin only.', [], 403);

    const formData = await req.formData();
    const title = formData.get('title') as string;
    const caption = formData.get('caption') as string;
    const imageFile = formData.get('image') as File | null;

    const parsed = heroSlideCreateSchema.safeParse({ title, caption });
    if (!parsed.success) return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);

    if (!imageFile) return errorRes('Image file is required.', [], 400);

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(imageFile.type)) {
      return errorRes('Invalid image format. Only JPEG, PNG, WebP allowed.', [], 400);
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const imageKey = await uploadFile('hero-slides', {
      buffer,
      originalname: imageFile.name,
      mimetype: imageFile.type,
      size: buffer.length,
    });

    const slide = await prisma.heroSlide.create({
      data: {
        title,
        caption,
        imageKey,
      },
    });

    return successRes(slide, 'Hero slide created.', 201);
  } catch (err) {
    console.error('Hero slide create error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
