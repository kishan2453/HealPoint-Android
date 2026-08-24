/**
 * TEMPORARY alias resolution test — deleted after verification.
 * Imports using BARE module names (no @/) that the tsconfig paths must resolve.
 */
import { Palette } from "constants/theme";
import { Button } from "ui/Button";
import { Input } from "ui/Input";
import type { Doctor } from "types";
import { useAuth } from "hooks/use-auth";
import * as doctorLib from "lib/doctor";
import { api } from "services/api";

export const __aliasTest = {
  color: Palette.primary,
  Button,
  Input,
  doctor: [] as Doctor[],
  useAuth,
  doctorLib,
  api,
};
