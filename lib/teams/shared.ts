import { Prisma } from '@prisma/client'

export const teamInclude = {
  members: {
    orderBy: [{ isLead: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      role: true,
      responsibilities: true,
      isLead: true,
      order: true,
      user: {
        select: { id: true, name: true, email: true, image: true, position: true },
      },
    },
  },
} satisfies Prisma.TeamInclude

export function emptyToNull(v: string | null | undefined) {
  const t = v?.trim()
  return t ? t : null
}
