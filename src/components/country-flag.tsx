import Image from 'next/image';

export function CountryFlag({
  code,
  name,
  size = 'md',
}: {
  code: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap = {
    sm: { w: 24, h: 18 },
    md: { w: 32, h: 24 },
    lg: { w: 48, h: 36 },
  };

  const { w, h } = sizeMap[size];

  return (
    <Image
      src={`/flags/${code.toLowerCase()}.svg`}
      alt={`Bandera de ${name}`}
      width={w}
      height={h}
      className="rounded-sm"
    />
  );
}
