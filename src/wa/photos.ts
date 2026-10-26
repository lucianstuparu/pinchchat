/** The faces' photos, given once at Relay's top so every screen shows the same ones (Face reads it). */
import { createContext } from 'react';
import type { Photos } from './api';

export const FacePhotos = createContext<Photos>({});
