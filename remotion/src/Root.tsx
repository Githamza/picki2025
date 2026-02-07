import React from 'react';
import {Composition, Folder} from 'remotion';
import {Reel, ReelSchema} from './Reel';
import {WhyPicki} from './WhyPicki';

// Total duration: 5 scenes (60+70+70+70+70) - 4 transitions (10*4) = 300 frames = 10s
const WHY_PICKI_DURATION = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Social">
        <Composition
          id="WhyPicki"
          component={WhyPicki}
          durationInFrames={WHY_PICKI_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Reel"
          component={Reel}
          durationInFrames={150}
          fps={30}
          width={1080}
          height={1920}
          schema={ReelSchema}
          defaultProps={{
            title: 'Picki',
            subtitle: 'Your favorite food, delivered.',
          }}
        />
      </Folder>
    </>
  );
};
