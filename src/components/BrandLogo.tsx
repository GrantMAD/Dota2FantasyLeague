import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = '', priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/Images/Dota2FantasyLeagueLogo-mark.png"
      alt=""
      width={505}
      height={606}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
