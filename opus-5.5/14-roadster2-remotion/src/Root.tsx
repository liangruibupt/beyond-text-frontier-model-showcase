import { Composition } from 'remotion';
import { Roadster, ROADSTER_FPS, roadsterDurationInFrames } from './Roadster';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Roadster"
      component={Roadster}
      durationInFrames={roadsterDurationInFrames()}
      fps={ROADSTER_FPS}
      width={1920}
      height={1080}
    />
  );
};
