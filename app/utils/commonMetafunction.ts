interface CommonMetaFunctionProps {
  title: string | null;
  description: string | null;
  url: string | null;
  image: string | null;
}

export function commonMetaFunction({
  title,
  description,
  url,
  image,
}: CommonMetaFunctionProps) {
  const commonTitle = title
    ? `${title} - 健常者エミュレータ事例集`
    : '健常者エミュレータ事例集';
  const commonDescription = description ?? '現実世界のために';
  const commonImage =
    image ??
    'https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png';
  return [
    { title: commonTitle },
    { description: commonDescription },
    { property: 'og:title', content: commonTitle },
    { property: 'og:description', content: commonDescription },
    { property: 'og:locale', content: 'ja_JP' },
    { property: 'og:site_name', content: '健常者エミュレータ事例集' },
    { property: 'og:type', content: 'article' },
    {
      property: 'og:url',
      content: url ?? 'https://healthy-person-emulator.org',
    },
    { property: 'og:image', content: commonImage },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: '@helthypersonemu' },
    { name: 'twitter:title', content: commonTitle },
    { name: 'twitter:description', content: commonDescription },
    { name: 'twitter:creator', content: '@helthypersonemu' },
    { name: 'twitter:image', content: commonImage },
  ];
}
