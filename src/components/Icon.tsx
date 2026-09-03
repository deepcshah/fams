import Svg, { Path } from 'react-native-svg';

/**
 * A small, hand-drawn icon set on a 24×24 grid. Bundling the paths avoids an
 * icon-font dependency, which keeps web, iOS and Android pixel-identical and
 * removes a font-loading flash on the web build.
 */
const ICONS = {
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  check: ['m5 13 4 4L19 7'],
  search: ['M18 11a7 7 0 1 1-14 0 7 7 0 1 1 14 0', 'M20.5 20.5 16.2 16.2'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronUp: ['m18 15-6-6-6 6'],
  arrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  tree: ['M9.5 3h5v4h-5z', 'M12 7v3', 'M5 10h14', 'M5 10v3', 'M19 10v3', 'M2.5 13h5v4h-5z', 'M16.5 13h5v4h-5z'],
  sliders: [
    'M3 6h10',
    'M18 6h3',
    'M3 12h4',
    'M12 12h9',
    'M3 18h10',
    'M18 18h3',
    'M17.5 6a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
    'M11.5 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
    'M17.5 18a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
  ],
  pencil: ['M12 20h9', 'M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M18.5 6l-1 14h-11l-1-14', 'M10 11v5', 'M14 11v5'],
  heart: ['M20.8 5.7a5 5 0 0 0-7.1 0L12 7.4l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.4l8.8-8.6a5 5 0 0 0 0-7.1Z'],
  calendar: ['M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 1 1 6 0'],
  briefcase: [
    'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z',
    'M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3',
    'M3 13h18',
  ],
  download: ['M12 4v12', 'm7 11 5 5 5-5', 'M4 19h16'],
  upload: ['M12 20V8', 'm7 13 5-5 5 5', 'M4 4h16'],
  target: ['M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0', 'M12 2v3.5', 'M12 18.5V22', 'M2 12h3.5', 'M18.5 12H22', 'M13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 1 1 3 0'],
  fit: ['M3 9V4h5', 'M21 9V4h-5', 'M3 15v5h5', 'M21 15v5h-5'],
  camera: [
    'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z',
    'M15.5 13.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0',
  ],
  link: ['M10 13a5 5 0 0 0 7.1 0l2.5-2.5a5 5 0 0 0-7.1-7.1L11 4.9', 'M14 11a5 5 0 0 0-7.1 0l-2.5 2.5a5 5 0 0 0 7.1 7.1L13 19.1'],
  sparkle: ['M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z', 'M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z'],
  info: ['M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0', 'M12 11.5v5', 'M12 8v.01'],
  star: ['m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z'],
  clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0', 'M12 7v5l3 2'],
  cake: ['M3 20.5h18', 'M5 20.5v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7', 'M5 15.5h14', 'M12 11.5V8', 'M12 5.6v.01'],
  swap: ['M7 4v13', 'm4 14 3 3 3-3', 'M17 20V7', 'm14 10 3-3 3 3'],
  eye: ['M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0'],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICONS[name].map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
