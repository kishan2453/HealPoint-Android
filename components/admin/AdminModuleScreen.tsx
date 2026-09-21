/**
 * HealPoint - shared shell for Super Admin + Hospital Admin module screens.
 * Handles role guarding, header and loading/error/empty states so every portal
 * page stays consistent and professional.
 */
import React from 'react';
import { View } from 'react-native';

import { RoleGuard } from '@/components/RoleGuard';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Screen } from '@/components/ui/Screen';
import { Spacing } from '@/constants/theme';
import type { CanonicalRole } from '@/lib/roles';

interface AdminModuleScreenProps {
  title: string;
  subtitle?: string;
  allowedRoles?: CanonicalRole[];
  loading?: boolean;
  error?: string;
  empty?: { title: string; message?: string } | null;
  onRetry?: () => void;
  children: React.ReactNode;
  right?: React.ReactNode;
  /** Optional loading state replacement (e.g. a list skeleton). */
  loadingComponent?: React.ReactNode;
}

export function AdminModuleScreen({
  title,
  subtitle,
  allowedRoles = ['super_admin'],
  loading = false,
  error = '',
  empty = null,
  onRetry,
  children,
  right,
  loadingComponent,
}: AdminModuleScreenProps) {
  return (
    <RoleGuard allowedRoles={allowedRoles}>
      <View style={{ flex: 1 }}>
        <AppHeader title={title} subtitle={subtitle} showBack right={right} />
        {loading ? (
          loadingComponent ? (
            <>{loadingComponent}</>
          ) : (
            <Loading label="Loading..." />
          )
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : empty ? (
          <Screen contentStyle={{ paddingTop: Spacing.xl }}>
            <EmptyState title={empty.title} message={empty.message} />
          </Screen>
        ) : (
          children
        )}
      </View>
    </RoleGuard>
  );
}