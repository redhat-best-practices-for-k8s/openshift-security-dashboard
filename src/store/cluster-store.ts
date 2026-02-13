import { create } from "zustand";

interface ClusterState {
  // Connection
  kubeconfigLoaded: boolean;
  currentContext: string;
  availableContexts: { name: string; cluster: string; user: string; namespace?: string }[];
  selectedNamespace: string; // "" means all namespaces
  availableNamespaces: string[];
  
  // Loading states
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  
  // Actions
  setKubeconfigLoaded: (loaded: boolean) => void;
  setCurrentContext: (context: string) => void;
  setAvailableContexts: (contexts: { name: string; cluster: string; user: string; namespace?: string }[]) => void;
  setSelectedNamespace: (namespace: string) => void;
  setAvailableNamespaces: (namespaces: string[]) => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (key: string, error: string | null) => void;
  reset: () => void;
}

const initialState = {
  kubeconfigLoaded: false,
  currentContext: "",
  availableContexts: [],
  selectedNamespace: "",
  availableNamespaces: [],
  loading: {},
  errors: {},
};

export const useClusterStore = create<ClusterState>((set) => ({
  ...initialState,
  setKubeconfigLoaded: (loaded) => set({ kubeconfigLoaded: loaded }),
  setCurrentContext: (context) => set({ currentContext: context }),
  setAvailableContexts: (contexts) => set({ availableContexts: contexts }),
  setSelectedNamespace: (namespace) => set({ selectedNamespace: namespace }),
  setAvailableNamespaces: (namespaces) => set({ availableNamespaces: namespaces }),
  setLoading: (key, loading) =>
    set((state) => ({ loading: { ...state.loading, [key]: loading } })),
  setError: (key, error) =>
    set((state) => ({ errors: { ...state.errors, [key]: error } })),
  reset: () => set(initialState),
}));
