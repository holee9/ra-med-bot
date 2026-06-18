// @MX:TEST [E2E] /api/ra/projects/[id] RBAC验证 — 비멤버 403, 멤버 200, Next.js 15 Promise params 올바른 처리
// @MX:SPEC Issue #150 (P0 Security/RBAC gap fix)

import { test, expect } from '@playwright/test';

test.describe('/api/ra/projects/[id] RBAC验证', () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  // 테스트 사용자: 이메일/역할이 정확해야 함 (DB와 일치)
  const raLeadUser = {
    email: process.env.TEST_RA_LEAD_EMAIL || 'ra-lead@example.com',
    password: process.env.TEST_RA_LEAD_PASSWORD || 'password123',
    expectedRole: 'ra-lead',
  };

  const raMemberUser = {
    email: process.env.TEST_RA_MEMBER_EMAIL || 'ra-member@example.com',
    password: process.env.TEST_RA_MEMBER_PASSWORD || 'password123',
    expectedRole: 'ra-member',
  };

  let testProjectId: string;
  let memberProjectId: string;
  let nonMemberProjectId: string;

  test.beforeAll(async () => {
    // 1) ra-lead 로그인 후 자신의 프로젝트 ID 2개 가져오기
    const leadResp = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(raLeadUser),
    });
    expect(leadResp.ok).toBeTruthy();
    const leadData = await leadResp.json();
    expect(leadData.sessionToken).toBeTruthy();

    const projectsResp = await fetch(`${baseUrl}/api/ra/projects`, {
      headers: {
        'Cookie': `authjs.session-token=${leadData.sessionToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(projectsResp.ok).toBeTruthy();
    const projectsData = await projectsResp.json();
    expect(projectsData.projects).toBeInstanceOf(Array);
    expect(projectsData.projects.length).toBeGreaterThanOrEqual(2);

    // 첫 번째 프로젝트는 ra-lead 소유 (memberProjectId)
    // 두 번째 프로젝트도 ra-lead 소유 (nonMemberProjectId는 다른 사용자)
    memberProjectId = projectsData.projects[0].id;
    testProjectId = projectsData.projects[0].id;

    // 2) 다른 사용자의 프로젝트 ID 얻기 (ra-member가 속하지 않은 프로젝트)
    // 실제 환경에서는 프로젝트 생성 시 다른 사용자가 생성한 프로젝트가 있어야 함
    // 테스트 목적으로 ra-member가 속하지 않은 프로젝트 ID 설정
    const memberResp = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(raMemberUser),
    });
    expect(memberResp.ok).toBeTruthy();
    const memberData = await memberResp.json();

    const memberProjectsResp = await fetch(`${baseUrl}/api/ra/projects`, {
      headers: {
        'Cookie': `authjs.session-token=${memberData.sessionToken}`,
        'Content-Type': 'application/json',
      },
    });
    expect(memberProjectsResp.ok).toBeTruthy();
    const memberProjectsData = await memberProjectsResp.json();

    // ra-member가 속한 프로젝트
    if (memberProjectsData.projects.length > 0) {
      const memberIdProject = memberProjectsData.projects[0].id;
      // ra-member 프로젝트와 ra-lead 프로젝트가 다른지 확인
      nonMemberProjectId = (memberIdProject !== testProjectId) ? memberIdProject : testProjectId;
    } else {
      // ra-member가 속한 프로젝트가 없는 경우, dummy ID 사용
      nonMemberProjectId = '00000000-0000-0000-0000-000000000000';
    }
  });

  test('GET /api/ra/projects/[id] — 멤버는 200, 비멤버는 403', async ({ request }) => {
    // 1) ra-member 로그인
    const loginResp = await request.post(`${baseUrl}/api/auth/login`, {
      data: raMemberUser,
    });
    expect(loginResp.ok()).toBeTruthy();
    const loginData = await loginResp.json();
    expect(loginData.sessionToken).toBeTruthy();

    // 2) 멤버 프로젝트 GET — 200 예상
    const memberResp = await request.get(`${baseUrl}/api/ra/projects/${memberProjectId}`, {
      headers: {
        'Cookie': `authjs.session-token=${loginData.sessionToken}`,
      },
    });
    expect(memberResp.ok()).toBeTruthy();
    const memberData = await memberResp.json();
    expect(memberData.project).toBeDefined();
    expect(memberData.project.id).toBe(memberProjectId);

    // 3) 비멤버 프로젝트 GET — 403 예상
    const nonMemberResp = await request.get(`${baseUrl}/api/ra/projects/${nonMemberProjectId}`, {
      headers: {
        'Cookie': `authjs.session-token=${loginData.sessionToken}`,
      },
    });
    expect(nonMemberResp.status()).toBe(403);
    const errorData = await nonMemberResp.json();
    expect(errorData.error).toMatch(/not_a_member|permission_denied/);
  });

  test('PATCH /api/ra/projects/[id] — 멤버는 200, 비멤버는 403', async ({ request }) => {
    // 1) ra-lead 로그인 (project.manage 권한 있음)
    const loginResp = await request.post(`${baseUrl}/api/auth/login`, {
      data: raLeadUser,
    });
    expect(loginResp.ok()).toBeTruthy();
    const loginData = await loginResp.json();
    expect(loginData.sessionToken).toBeTruthy();

    // 2) 멤버 프로젝트 PATCH — 200 예상
    const updateData = { name: 'Updated Project Name (RBAC test)' };
    const memberResp = await request.patch(`${baseUrl}/api/ra/projects/${memberProjectId}`, {
      headers: {
        'Cookie': `authjs.session-token=${loginData.sessionToken}`,
        'Content-Type': 'application/json',
      },
      data: updateData,
    });
    expect(memberResp.ok()).toBeTruthy();
    const result = await memberResp.json();
    expect(result.project).toBeDefined();
    expect(result.project.name).toBe(updateData.name);

    // 3) 비멤버 프로젝트 PATCH — 403 예상
    const nonMemberResp = await request.patch(`${baseUrl}/api/ra/projects/${nonMemberProjectId}`, {
      headers: {
        'Cookie': `authjs.session-token=${loginData.sessionToken}`,
        'Content-Type': 'application/json',
      },
      data: { name: 'Should not update' },
    });
    expect(nonMemberResp.status()).toBe(403);
    const errorData = await nonMemberResp.json();
    expect(errorData.error).toMatch(/not_a_member|permission_denied/);
  });

  test('Next.js 15 Promise params 환경에서 project-scoped permission이 올바르게 작동', async ({ request }) => {
    // 이 테스트는 Next.js 15 async params가 올바르게 처리되는지 검증
    const loginResp = await request.post(`${baseUrl}/api/auth/login`, {
      data: raLeadUser,
    });
    expect(loginResp.ok()).toBeTruthy();
    const loginData = await loginResp.json();

    // Promise params가 올바르게 resolved되어 projectId가 전달되는지 확인
    const getResp = await request.get(`${baseUrl}/api/ra/projects/${testProjectId}`, {
      headers: {
        'Cookie': `authjs.session-token=${loginData.sessionToken}`,
      },
    });
    expect(getResp.ok()).toBeTruthy();
    const getData = await getResp.json();
    expect(getData.project).toBeDefined();
    expect(getData.project.id).toBe(testProjectId);
  });
});
