import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

/** Message bref (« Sourate ajoutée aux favoris ») qui apparaît puis s'efface seul. */
export const useToast = () => {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      setText(message);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      }, 2500);
    },
    [opacity]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { show, text, opacity };
};

interface ToastProps {
  text: string | null;
  opacity: Animated.Value;
  background: string;
  border: string;
  color: string;
  /** Distance au haut de l'écran. */
  top: number;
}

export const Toast: React.FC<ToastProps> = ({ text, opacity, background, border, color, top }) => (
  <Animated.View pointerEvents="none" style={[styles.toast, { top, opacity, backgroundColor: background, borderColor: border }]}>
    <Text style={[styles.text, { color }]}>{text}</Text>
  </Animated.View>
);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    zIndex: 10,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
});
