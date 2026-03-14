/// <reference types="vite/client" />

interface Window {
  Telegram: {
    WebApp: {
      initData: string;
      initDataUnsafe: {
        user?: {
          id: number;
          first_name: string;
          last_name?: string;
          username?: string;
          photo_url?: string;
          language_code?: string;
        };
      };
      ready: () => void;
      expand: () => void;
      close: () => void;
      requestFullscreen: () => void;
      MainButton: {
        text: string;
        show: () => void;
        hide: () => void;
        onClick: (fn: () => void) => void;
        offClick: (fn: () => void) => void;
        enable: () => void;
        disable: () => void;
        showProgress: (leaveActive?: boolean) => void;
        hideProgress: () => void;
        setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean }) => void;
      };
      BackButton: {
        show: () => void;
        hide: () => void;
        onClick: (fn: () => void) => void;
        offClick: (fn: () => void) => void;
      };
      HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        selectionChanged: () => void;
      };
      colorScheme: 'light' | 'dark';
      themeParams: Record<string, string>;
      openInvoice: (url: string, callback?: (status: string) => void) => void;
      setBackgroundColor: (color: string) => void;
      setHeaderColor: (color: string) => void;
    };
  };
}
