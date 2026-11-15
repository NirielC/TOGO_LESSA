import { createContext, useContext } from 'react';

export const Ctx = createContext(null);
/** { sesion, uid, perfil, acuerdo, recargar, setPerfil } */
export const useApp = () => useContext(Ctx);
