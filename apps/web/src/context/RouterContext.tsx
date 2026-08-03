import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type RouterValue = {
  path: string;
  navigate: (path: string, replace?: boolean) => void;
};

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const navigate = useCallback((next: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);
    setPath(window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside RouterProvider');
  return value;
}

export function Link({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
