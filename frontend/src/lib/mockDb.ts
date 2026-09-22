export const mockDb = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signUp: async () => ({ data: null, error: null }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
  },
  from: () => {
    const p: any = Promise.resolve({ data: [] as any[], error: null, count: 0 });
    p.select = () => p;
    p.insert = () => p;
    p.update = () => p;
    p.delete = () => p;
    p.eq = () => p;
    p.in = () => p;
    p.order = () => p;
    p.single = async () => ({ data: null, error: null });
    p.maybeSingle = async () => ({ data: null, error: null });
    return p;
  },
  channel: () => ({ on: () => ({ subscribe: () => {} }) }),
  removeChannel: () => {},
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
} as any;
