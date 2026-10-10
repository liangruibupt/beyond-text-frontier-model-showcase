import { Composition } from 'remotion';
import { LiveFlashShowcase, LIVE_FLASH_SHOWCASE_DURATION } from './LiveFlashShowcase';
export const Root: React.FC = () => (
  <Composition id="LiveFlashShowcase" component={LiveFlashShowcase}
    durationInFrames={LIVE_FLASH_SHOWCASE_DURATION} fps={30} width={1920} height={1080} />
);
