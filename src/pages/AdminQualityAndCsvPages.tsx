import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import type { DataQualityIssue } from '../../shared/types.ts';
import {
  Button,
  Card,
  ConfirmDialog,
  Input,
  Select,
  Skeleton,
} from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { SAMPLE_CSV_TEMPLATE } from '../lib/csv.ts';
import { formatDate } from '../lib/utils.ts';
import { AdminShell } from './AdminPages.tsx';

export function AdminCsvImportPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { refreshMetadata, showNotice } = useCompare();
  const [csvContent, setCsvContent] = useState(SAMPLE_CSV_TEMPLATE);
  const [report, setReport] = useState<{
    importedCount?: number;
    validCount?: number;
    errors: Array<{ rowNumber: number; message: string }>;
    message?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvContent(reader.result);
        setReport(null);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparex-product-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async (dryRun: boolean) => {
    setSubmitting(true);
    setReport(null);
    try {
      const res = await apiRequest<{
        importedCount?: number;
        validCount?: number;
        errors: Array<{ rowNumber: number; message: string }>;
        message?: string;
      }>('/api/admin/csv-import', {
        method: 'POST',
        body: JSON.stringify({ csvContent, dryRun }),
      });
      setReport(res);
      if (!dryRun) {
        await refreshMetadata();
        showNotice('success', res.message || 'CSV products imported successfully.');
      } else {
        showNotice('success', `Validation passed for ${res.validCount} row(s).`);
      }
    } catch (err: any) {
      const details = err.details as any;
      setReport({
        errors: details?.errors || [{ rowNumber: 1, message: err.message }],
        validCount: details?.validCount ?? 0,
      });
      showNotice('error', err.message || 'CSV validation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Bulk CSV Product Import"
      subtitle="Validate CSV column headers, data types, and category slugs before committing batch imports."
    >
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Download Sample CSV Template
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#070D1A] px-3.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors">
              <Upload className="h-4 w-4 text-sky-400" />
              <span>Upload .csv File</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="sr-only" />
            </label>
          </div>
          <span className="text-xs text-slate-400">
            Required columns: name, brand, categorySlug, modelNumber, basePrice, description
          </span>
        </div>

        <textarea
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          rows={10}
          aria-label="CSV product import content"
          className="w-full rounded-xl border border-slate-700/80 bg-[#070D1A] p-3.5 font-mono text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        />

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => runImport(true)}
            disabled={submitting}
          >
            Validate CSV Only
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => runImport(false)}
            disabled={submitting}
          >
            {submitting ? 'Processing...' : 'Validate & Import Products'}
          </Button>
        </div>
      </Card>

      {report && (
        <Card className="p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-white">
            Import Validation Report
          </h2>
          {report.errors.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {report.importedCount
                  ? `Imported ${report.importedCount} product(s) cleanly.`
                  : `All ${report.validCount} row(s) passed validation and are ready to import.`}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-400">
                Found {report.errors.length} validation issue(s):
              </p>
              <ul className="space-y-1.5 text-xs text-red-200 bg-red-950/60 border border-red-800/80 rounded-lg p-3">
                {report.errors.map((err, i) => (
                  <li key={i} className="font-mono">
                    Row {err.rowNumber}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </AdminShell>
  );
}

export function AdminUsersPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<{
    user: any;
    patch: { role?: string; isActive?: boolean };
    title: string;
    description: string;
  } | null>(null);

  const load = () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    apiRequest<{ users: any[] }>('/api/admin/users')
      .then((res) => setUsersList(res.users))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersList, query]);

  const confirmUpdateUser = async () => {
    if (!pendingAction) return;
    try {
      await apiRequest(`/api/admin/users/${pendingAction.user.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify(pendingAction.patch),
      });
      load();
      showNotice('success', 'User access updated.');
    } catch (err: any) {
      showNotice('error', err.message || 'Update failed.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="User & Role Management"
      subtitle="Inspect registered consumer and administrator accounts and enforce role assignments."
    >
      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users by name or email..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {filteredUsers.length} account(s)
          </span>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#080F1E] border-b border-slate-800 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Joined</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/35">
                    <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-sky-400">
                      {u.role}
                    </td>
                    <td
                      className={`px-4 py-3 text-xs font-medium ${
                        u.isActive ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Suspended'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 tabular-nums">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAction({
                            user: u,
                            patch: { role: u.role === 'ADMIN' ? 'CONSUMER' : 'ADMIN' },
                            title: 'Change Account Role',
                            description: `Update ${u.email} to ${u.role === 'ADMIN' ? 'CONSUMER' : 'ADMIN'} role?`,
                          })
                        }
                        className="font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        Make {u.role === 'ADMIN' ? 'Consumer' : 'Admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingAction({
                            user: u,
                            patch: { isActive: !u.isActive },
                            title: u.isActive ? 'Suspend Account' : 'Reactivate Account',
                            description: `${u.isActive ? 'Suspend' : 'Reactivate'} platform access for ${u.email}?`,
                          })
                        }
                        className="font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title || 'Confirm User Action'}
        description={pendingAction?.description || ''}
        confirmLabel="Apply Change"
        destructive={pendingAction?.patch.isActive === false}
        onConfirm={confirmUpdateUser}
        onCancel={() => setPendingAction(null)}
      />
    </AdminShell>
  );
}

export function AdminDataQualityPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();
  const [report, setReport] = useState<{ summary: any; issues: DataQualityIssue[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  const load = () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    apiRequest<{ summary: any; issues: DataQualityIssue[] }>('/api/admin/data-quality')
      .then(setReport)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleResolveConflict = async (specId: number) => {
    try {
      await apiRequest(`/api/admin/data-quality/resolve-conflict/${specId}`, { method: 'POST' });
      showNotice('success', 'Specification conflict verified and cleared.');
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Could not resolve conflict.');
    }
  };

  const handleRefreshOffer = async (offerId: number) => {
    try {
      await apiRequest(`/api/admin/data-quality/refresh-offer/${offerId}`, { method: 'POST' });
      showNotice('success', 'Offer price observation timestamp refreshed.');
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Could not refresh offer.');
    }
  };

  const visibleIssues = (report?.issues || []).filter(
    (i) => severityFilter === 'ALL' || i.severity === severityFilter
  );

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Data Quality Reports"
      subtitle="Automated detection for missing mandatory specs, duplicates, invalid prices, inconsistent units, conflicts, and stale observations."
    >
      {loading || !report ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-slate-400">Catalog Health Score</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">
                {report.summary.healthScore}/100
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-400">High Severity</div>
              <div className="font-mono text-2xl font-bold text-red-400 tabular-nums mt-1">
                {report.summary.highSeverity}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-400">Medium Severity</div>
              <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1">
                {report.summary.mediumSeverity}
              </div>
            </Card>
            <Card className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Total Issues</div>
                <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                  {report.summary.totalIssues}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={load} aria-label="Re-run audit">
                <RefreshCw className="h-4 w-4 text-sky-400" />
              </Button>
            </Card>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Select
              aria-label="Filter issues by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-48 h-9 text-xs"
            >
              <option value="ALL">All Severities ({report.issues.length})</option>
              <option value="HIGH">High Severity Only</option>
              <option value="MEDIUM">Medium Severity Only</option>
              <option value="LOW">Low Severity Only</option>
            </Select>
          </div>

          {visibleIssues.length === 0 ? (
            <Card className="p-8 text-center text-sm text-emerald-400 font-medium">
              Zero matching data quality issues detected.
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleIssues.map((issue) => (
                <Card
                  key={issue.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-mono font-bold ${
                          issue.severity === 'HIGH'
                            ? 'text-red-400'
                            : issue.severity === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono text-slate-400">{issue.issueType}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-sky-400 font-semibold">{issue.productName}</span>
                    </div>
                    <p className="text-sm text-white">{issue.description}</p>
                    <p className="text-xs text-slate-400">{issue.suggestedAction}</p>
                  </div>

                  <div className="shrink-0">
                    {issue.issueType === 'CONFLICTING_SPEC' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveConflict(issue.entityId)}
                      >
                        Verify & Clear Conflict
                      </Button>
                    ) : issue.issueType === 'OUTDATED_PRICE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshOffer(issue.entityId)}
                      >
                        Mark Verified Today
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/admin/products')}
                      >
                        Edit in Products
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}

export function AdminAuditLogsPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const load = () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    apiRequest<{ logs: any[] }>('/api/admin/audit-logs')
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        String(l.actorEmail).toLowerCase().includes(q) ||
        String(l.action).toLowerCase().includes(q) ||
        String(l.entityType).toLowerCase().includes(q) ||
        String(l.entityId).toLowerCase().includes(q)
    );
  }, [logs, query]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const pagedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="System Audit Logs"
      subtitle="Immutable trail of administrative actions across products, schemas, brands, offers, and user roles."
    >
      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search actor, action, or entity..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#080F1E] border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                  <th className="px-4 py-3 text-left font-semibold">Actor</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                  <th className="px-4 py-3 text-left font-semibold">Entity</th>
                  <th className="px-4 py-3 text-left font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {pagedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No matching audit entries recorded.
                    </td>
                  </tr>
                ) : (
                  pagedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/35">
                      <td className="px-4 py-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{log.actorEmail}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-sky-400">{log.action}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {log.entityType} #{log.entityId}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono tabular-nums">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
