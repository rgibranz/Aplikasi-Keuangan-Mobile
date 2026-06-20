// Bus mini: memberi tahu layar yang sedang ter-mount agar memuat ulang data
// setelah sync menarik perubahan dari server (mis. hidrasi awal / device lain).
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSynced(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitSynced(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // abaikan listener yang error
    }
  });
}
