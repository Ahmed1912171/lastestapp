import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const branches = [
  { id: '1', name: 'CHK', fullName: 'Children Hospital\nKorangi 5', year: '2022', city: 'KARACHI' },
  { id: '2', name: 'JPMC', fullName: 'NICU - JPMC', year: '2023', city: 'KARACHI' },
  { id: '3', name: 'CHS', fullName: 'Children Hospital\nSukkur', year: '2023', city: 'SUKKUR' },
  { id: '4', name: 'SBA', fullName: 'NICU & PICU', year: '2024', city: 'NAWABSHAH' },
  { id: '5', name: 'AZB', fullName: 'Children Hospital\nAzizabad', year: '2025', city: 'KARACHI' },
  { id: '6', name: 'LKZ', fullName: 'Lakson Hospital', year: '2025', city: 'KARACHI' },
  { id: '7', name: 'SOB', fullName: 'Sobhraj Hospital', year: '2025', city: 'KARACHI' },
  { id: '8', name: 'JAM', fullName: 'Jamshoro Hospital', year: '2025', city: 'JAMSHORO' },
];

function AnimatedBranchNode({ item, index, position }: { item: typeof branches[0]; index: number; position: 'left' | 'right' }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const translateX = useSharedValue(position === 'left' ? -30 : 30);

  useEffect(() => {
    const delay = index * 400 + 1000;

    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200 })
      )
    );
    translateX.value = withDelay(
      delay,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.back(1.1)) })
    );
  }, [index, opacity, scale, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
  }));

  return (
    <View style={[styles.nodeContainer, position === 'left' ? styles.nodeLeft : styles.nodeRight]}>
      <Animated.View style={animatedStyle}>
        <View style={styles.cityLabel}>
          <Text style={styles.cityText}>{item.city}</Text>
        </View>
        <Text style={styles.branchFullName}>{item.fullName}</Text>
      </Animated.View>
    </View>
  );
}

function AnimatedYearBadge({ year, index }: { year: string; index: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    const delay = index * 400 + 800;

    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.3, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200 })
      )
    );
  }, [index, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const yearColors = {
    '2022': '#f3e5ab',
    '2023': '#a8d5ba',
    '2024': '#e8b4b8',
    '2025': '#d4c5a9',
  };

  return (
    <Animated.View style={[styles.yearBadge, { backgroundColor: yearColors[year as keyof typeof yearColors] || '#ddd' }, animatedStyle]}>
      <Text style={styles.yearText}>{year}</Text>
    </Animated.View>
  );
}

function AnimatedDot({ index }: { index: number }) {
  const scale = useSharedValue(0);
  const innerScale = useSharedValue(1);

  useEffect(() => {
    const delay = index * 400 + 1200;

    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.5, { duration: 250 }),
        withTiming(1, { duration: 250 })
      )
    );

    innerScale.value = withDelay(
      delay + 500,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [index, innerScale, scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const innerDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  return (
    <Animated.View style={[styles.pathDot, dotStyle]}>
      <Animated.View style={[styles.pathDotInner, innerDotStyle]} />
    </Animated.View>
  );
}

function AnimatedPathway() {
  const pathLength = useSharedValue(0);

  useEffect(() => {
    pathLength.value = withDelay(
      400,
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) })
    );
  }, [pathLength]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: 1000 - pathLength.value * 1000,
  }));

  return (
    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
      <AnimatedPath
        d="M 180 80 Q 200 100, 180 130 Q 160 160, 180 190 Q 200 220, 180 250 Q 160 280, 180 310 Q 200 340, 180 370 Q 160 400, 180 430 Q 200 460, 180 490 Q 160 520, 180 550"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="3"
        fill="none"
        strokeDasharray="1000"
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export default function SplashScreen() {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.8);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 600 });
    titleScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) });
    subtitleOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
  }, [subtitleOpacity, titleOpacity, titleScale]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <LinearGradient colors={['#22c55e', '#16a34a', '#15803d']} style={styles.container}>
      <View style={styles.header}>
        <Animated.Text style={[styles.title, titleAnimatedStyle]}>
          Branch Roadmap
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
          Our Journey Together
        </Animated.Text>
      </View>

      <View style={styles.roadmapContainer}>
        <AnimatedPathway />

        <View style={styles.timelineContainer}>
          {branches.map((branch, index) => {
            const isLeft = index % 2 === 0;
            const showYear = index === 0 || branches[index - 1].year !== branch.year;

            return (
              <View key={branch.id} style={styles.timelineRow}>
                {isLeft ? (
                  <>
                    <AnimatedBranchNode item={branch} index={index} position="left" />
                    <View style={styles.centerColumn}>
                      <AnimatedDot index={index} />
                      {showYear && <AnimatedYearBadge year={branch.year} index={index} />}
                    </View>
                    <View style={styles.nodeContainer} />
                  </>
                ) : (
                  <>
                    <View style={styles.nodeContainer} />
                    <View style={styles.centerColumn}>
                      <AnimatedDot index={index} />
                      {showYear && <AnimatedYearBadge year={branch.year} index={index} />}
                    </View>
                    <AnimatedBranchNode item={branch} index={index} position="right" />
                  </>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Expanding Our Network</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
  },
  roadmapContainer: {
    flex: 1,
    position: 'relative',
  },
  timelineContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 70,
  },
  nodeContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nodeLeft: {
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  nodeRight: {
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  cityLabel: {
    marginBottom: 4,
  },
  cityText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  branchFullName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 16,
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    position: 'relative',
  },
  yearBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  yearText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  pathDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pathDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontWeight: '500',
  },
});
