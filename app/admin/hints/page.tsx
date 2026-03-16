import { getPendingHints } from '@/app/actions/admin'
import HintsClient from './HintsClient'

export default async function HintsPage() {
  const hints = await getPendingHints()
  return <HintsClient initialHints={hints} />
}
