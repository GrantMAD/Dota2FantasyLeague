import sharp from 'sharp';
import {
  createSeasonRecapShareCardSvg,
  type SeasonRecap,
  type SeasonRecapCardTheme,
} from './season-recap';

export async function renderSeasonRecapPng(
  recap: SeasonRecap,
  theme: SeasonRecapCardTheme,
): Promise<Buffer> {
  return sharp(Buffer.from(createSeasonRecapShareCardSvg(recap, theme)))
    .png()
    .toBuffer();
}
