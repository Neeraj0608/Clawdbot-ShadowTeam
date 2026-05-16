import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successRes, errorRes, authenticate, authorize } from '@/lib/api-helpers';
import { newsCreateSchema } from '@/lib/validators';
import { uploadFile, getSignedUrl } from '@/lib/minio';

// POST /api/news — faculty/admin creates news post with image
export async function POST(req: NextRequest) {
  try {
    const user = authenticate(req);
    if (!user) return errorRes('Unauthorized', [], 401);
    if (!authorize(user, 'ADMIN', 'FACULTY')) return errorRes('Forbidden', [], 403);

    const formData = await req.formData();
    const title = formData.get('title') as string;
    const caption = formData.get('caption') as string;
    const imageFile = formData.get('image') as File | null;

    const parsed = newsCreateSchema.safeParse({ title, caption });
    if (!parsed.success) return errorRes('Validation failed', parsed.error.issues.map((e: any) => e.message), 400);

    if (!imageFile) return errorRes('Image file is required.', [], 400);

    // Validate MIME
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(imageFile.type)) {
      return errorRes('Invalid image format. Only JPEG, PNG, WebP allowed.', [], 400);
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const imageKey = await uploadFile('news', {
      buffer,
      originalname: imageFile.name,
      mimetype: imageFile.type,
      size: buffer.length,
    });

    const post = await prisma.newsPost.create({
      data: { title, caption, imageKey, postedById: user.id },
    });

    return successRes(post, 'News post created.', 201);
  } catch (err) {
    console.error('News create error:', err);
    return errorRes('Internal server error', [], 500);
  }
}

// GET /api/news — public, returns visible news with signed image URLs
export async function GET() {
  try {
    const posts = await prisma.newsPost.findMany({
      where: { isVisible: true },
      orderBy: { publishedAt: 'desc' },
      include: { postedBy: { select: { id: true, name: true } } },
    });

    const withUrls = await Promise.all(
      posts.map(async (p) => ({
        ...p,
        imageUrl: await getSignedUrl(p.imageKey).catch(() => null),
      }))
    );

    return successRes(withUrls, 'News posts retrieved.');
  } catch (err) {
    console.error('News list error:', err);
    return errorRes('Internal server error', [], 500);
  }
}
