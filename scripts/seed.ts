import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEAMS = [
  { name: 'Team Alpha',   email: 'alpha@hunt.local',   password: 'Alpha2024!' },
  { name: 'Team Beta',    email: 'beta@hunt.local',    password: 'Beta2024!' },
  { name: 'Team Gamma',   email: 'gamma@hunt.local',   password: 'Gamma2024!' },
  { name: 'Team Delta',   email: 'delta@hunt.local',   password: 'Delta2024!' },
  { name: 'Team Epsilon', email: 'epsilon@hunt.local', password: 'Epsilon2024!' },
  { name: 'Team Zeta',    email: 'zeta@hunt.local',    password: 'Zeta2024!' },
  { name: 'Team Eta',     email: 'eta@hunt.local',     password: 'Eta2024!' },
  { name: 'Team Theta',   email: 'theta@hunt.local',   password: 'Theta2024!' },
  { name: 'Team Iota',    email: 'iota@hunt.local',    password: 'Iota2024!' },
  { name: 'Team Kappa',   email: 'kappa@hunt.local',   password: 'Kappa2024!' },
]

const ADMIN = {
  name: 'Admin',
  email: 'admin@hunt.local',
  password: 'Admin2024!Secret',
}

async function createUser(email: string, password: string, metadata: Record<string, string>) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: metadata,
    email_confirm: true,
  })
  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`  ↩ Already exists: ${email}`)
      // fetch existing user
      const { data: { users } } = await admin.auth.admin.listUsers()
      return users.find(u => u.email === email) ?? null
    }
    throw error
  }
  return data.user
}

async function main() {
  console.log('🌱 Seeding treasure hunt database...\n')

  // Create admin
  console.log('Creating admin account...')
  await createUser(ADMIN.email, ADMIN.password, { role: 'admin', team_name: ADMIN.name })
  console.log(`  ✓ ${ADMIN.email}`)

  // Create teams
  console.log('\nCreating team accounts...')
  const createdTeams: { id: string; name: string; email: string }[] = []

  for (const team of TEAMS) {
    const user = await createUser(team.email, team.password, {
      role: 'team',
      team_name: team.name,
    })
    if (user) {
      createdTeams.push({ id: user.id, name: team.name, email: team.email })
      console.log(`  ✓ ${team.email} (${team.name})`)
    }
  }

  // Seed team_progress rows
  console.log('\nSeeding team_progress rows...')
  for (const team of createdTeams) {
    const { error } = await admin
      .from('team_progress')
      .upsert(
        { team_id: team.id, current_question_index: 1, completed_at: null },
        { onConflict: 'team_id' }
      )
    if (error) {
      console.error(`  ✗ Failed for ${team.name}: ${error.message}`)
    } else {
      console.log(`  ✓ Progress row for ${team.name}`)
    }
  }

  console.log('\n✅ Seed complete!\n')
  console.log('─────────────────────────────────────────')
  console.log('Admin credentials:')
  console.log(`  Email:    ${ADMIN.email}`)
  console.log(`  Password: ${ADMIN.password}`)
  console.log('\nTeam credentials:')
  for (const team of TEAMS) {
    console.log(`  ${team.name.padEnd(14)} ${team.email.padEnd(25)} ${team.password}`)
  }
  console.log('─────────────────────────────────────────')
  console.log('⚠️  Save these credentials! Distribute to teams before the event.')
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
