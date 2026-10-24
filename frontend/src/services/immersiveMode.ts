/**
 * Lecture plein écran du Mushaf : quand ses barres sont masquées, la barre d'onglets de
 * l'app se cache aussi, pour laisser toute la hauteur au texte.
 */
let immersive = false;
let listeners: Array<(value: boolean) => void> = [];

export const setImmersive = (value: boolean): void => {
  if (value === immersive) return;
  immersive = value;
  listeners.forEach((cb) => cb(value));
};

export const subscribeImmersive = (callback: (value: boolean) => void) => {
  listeners.push(callback);
  callback(immersive);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
};
