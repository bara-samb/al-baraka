import { Platform } from 'react-native';
import { NavigationContainerRefWithCurrent, NavigationState, PartialState } from '@react-navigation/native';
import { RootStackParamList } from './types';

/**
 * Bouton « retour » du téléphone dans l'app web (PWA).
 *
 * La navigation de l'app ne passe pas par l'historique du navigateur : sans rien faire, le
 * bouton retour quitte l'app quel que soit l'écran. Tant qu'on n'est pas sur l'accueil (ou
 * qu'une fenêtre est ouverte), on garde donc une entrée « tampon » dans l'historique : le
 * retour la consomme, et on ferme la fenêtre ouverte ou on revient à l'écran précédent.
 * Sur l'accueil, sans fenêtre ouverte, il n'y a plus de tampon : le retour quitte l'app.
 * (Sur Android natif, React Navigation et les Modal gèrent déjà le bouton retour.)
 */

type AnyState = NavigationState | PartialState<NavigationState> | undefined;

const isAtHome = (state: AnyState): boolean => {
  if (!state) return true;
  const top = state.routes[state.index ?? 0];
  if (top.name !== 'MainTabs') return false;
  const tabs = top.state;
  return !tabs || tabs.routes[tabs.index ?? 0].name === 'HomeTab';
};

// Les Modal de react-native-web sont rendues dans le <body> avec aria-modal.
const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

const GUARD = { albarakaBack: true };

export const installWebBackButton = (navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  let guarded = !!window.history.state?.albarakaBack;
  let ignoreNextPop = false;

  const needsGuard = () => modalOpen() || !isAtHome(navigationRef.isReady() ? navigationRef.getRootState() : undefined);

  const sync = () => {
    const needed = needsGuard();
    if (needed && !guarded) {
      window.history.pushState(GUARD, '');
      guarded = true;
    } else if (!needed && guarded) {
      // Retour à l'accueil par un autre moyen (onglet, bouton fermer) : on retire le tampon
      // pour que le prochain retour quitte l'app du premier coup.
      ignoreNextPop = true;
      guarded = false;
      window.history.back();
    }
  };

  const onPopState = () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    guarded = false;
    if (modalOpen()) {
      // La Modal du dessus se ferme sur Échap (appelle son onRequestClose).
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
    } else if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    } else if (navigationRef.isReady() && !isAtHome(navigationRef.getRootState())) {
      navigationRef.navigate('MainTabs', { screen: 'HomeTab' } as never);
    }
    // La fenêtre fermée disparaît après son animation : on réévalue ensuite.
    setTimeout(sync, 400);
  };

  // Ouverture / fermeture des fenêtres (Modal) : leur contenu apparaît dans des portails du
  // <body>. Les mutations du DOM sont regroupées pour ne pas peser pendant le défilement.
  let pending: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      sync();
    }, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', onPopState);
  const unsubscribe = navigationRef.addListener('state', () => sync());

  return () => {
    observer.disconnect();
    if (pending) clearTimeout(pending);
    window.removeEventListener('popstate', onPopState);
    unsubscribe();
  };
};
