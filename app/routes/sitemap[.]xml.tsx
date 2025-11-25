import { getPostDataForSitemap } from '~/modules/db.server';

export async function loader() {
  const posts = await getPostDataForSitemap();
  const staticPagesData = ['', 'random', 'search', 'support', 'readme', 'post'];

  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${staticPagesData.map((page) => {
          return `<url>
                <loc>https://healthy-person-emulator.org/${page}</loc>
            </url>`;
        })}
        ${posts.map((post) => {
          return `<url>
                <loc>${post.loc}</loc>
            </url>`;
        })}
    </urlset>
    `;
  return new Response(xmlString, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `public, max-age=${60 * 60 * 24}`,
    },
  });
}
