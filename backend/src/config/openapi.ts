const bearer = [{ bearerAuth: [] }];
const ok = { '200': { description: 'Success' } };
const created = { '201': { description: 'Created' } };

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Digital Public Service Navigator API',
    version: '1.0.0',
    description:
      'Independent navigation and information service. Not an official government API. Success: { data, meta? }. Error: { error: { code, message, details? } }.',
  },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Supabase JWT' } } },
  paths: {
    '/health': { get: { summary: 'Health check', responses: ok } },
    '/api/categories': { get: { summary: 'List categories', responses: ok } },
    '/api/services': {
      get: {
        summary: 'Search and filter published services',
        parameters: ['q', 'category', 'state', 'level', 'sort', 'page', 'pageSize'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        responses: ok,
      },
    },
    '/api/services/{id}': { get: { summary: 'Service detail (id or slug) with eligibility questions', responses: ok } },
    '/api/eligibility/evaluate': { post: { summary: 'Deterministic eligibility check (preliminary, unofficial)', responses: ok } },
    '/api/assistant/query': { post: { summary: 'Assistant (grounded in stored records; works without AI)', responses: ok } },
    '/api/feedback': { post: { summary: 'Report inaccurate info or broken link', responses: created } },
    '/api/me': { get: { summary: 'Current user id and role (for UI navigation only)', security: bearer, responses: ok } },
    '/api/recommendations': { get: { summary: 'Personalised recommendations with reasons', security: bearer, responses: ok } },
    '/api/user/preferences': { get: { security: bearer, responses: ok }, put: { security: bearer, responses: ok } },
    '/api/user/saved-services': { get: { security: bearer, responses: ok }, post: { security: bearer, responses: created } },
    '/api/user/saved-services/{id}': { delete: { security: bearer, responses: { '204': { description: 'Deleted' } } } },
    '/api/user/checklists': { get: { security: bearer, responses: ok }, post: { security: bearer, responses: created } },
    '/api/user/checklists/{id}': { patch: { security: bearer, responses: ok } },
    '/api/user/assessments': { get: { security: bearer, responses: ok } },
    '/api/user/export': { get: { summary: 'Export all personal data', security: bearer, responses: ok } },
    '/api/user/account': { delete: { summary: 'Delete account and personal data', security: bearer, responses: { '204': { description: 'Deleted' } } } },
    '/api/admin/services': { get: { summary: 'Staff: list all services', security: bearer, responses: ok }, post: { summary: 'Editors: create service', security: bearer, responses: created } },
    '/api/admin/services/{id}': { get: { security: bearer, responses: ok }, patch: { summary: 'Editors: update', security: bearer, responses: ok }, delete: { summary: 'Super admin: delete', security: bearer, responses: { '204': { description: 'Deleted' } } } },
    '/api/admin/services/import': { post: { summary: 'Editors: CSV import (text/csv, ?dry_run=true)', security: bearer, responses: created } },
    '/api/admin/services/export': { get: { summary: 'Staff: CSV export', security: bearer, responses: ok } },
    '/api/admin/services/{id}/verify': { post: { summary: 'Editors: set verification status', security: bearer, responses: ok } },
    '/api/admin/verification-queue': { get: { security: bearer, responses: ok } },
    '/api/admin/feedback': { get: { security: bearer, responses: ok } },
    '/api/admin/analytics': { get: { summary: 'Aggregate analytics, no personal data', security: bearer, responses: ok } },
    '/api/admin/audit-logs': { get: { security: bearer, responses: ok } },
    '/api/admin/users/{id}/role': { patch: { summary: 'Super admin: change a role', security: bearer, responses: ok } },
  },
};
