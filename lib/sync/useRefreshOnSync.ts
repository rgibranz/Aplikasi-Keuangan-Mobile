import { useEffect } from 'react';
import { onSynced } from './bus';

// Dipanggil di layar yang menampilkan data: `load` akan dijalankan ulang
// setiap kali sync selesai menarik perubahan dari server. `load` sebaiknya
// stabil (useCallback) agar subscribe sekali saja.
export function useRefreshOnSync(load: () => void): void {
  useEffect(() => onSynced(load), [load]);
}
