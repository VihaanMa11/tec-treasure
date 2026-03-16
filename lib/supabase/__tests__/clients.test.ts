import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

describe('Supabase client utilities', () => {
  it('browser client is created without throwing', async () => {
    const { createClient } = await import('../client')
    expect(() => createClient()).not.toThrow()
  })

  it('admin client is created without throwing', async () => {
    const { createClient } = await import('../admin')
    expect(() => createClient()).not.toThrow()
  })
})
