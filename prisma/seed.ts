import { PrismaClient, Role, EmploymentType, EmployeeStatus, AppraisalPeriod } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding initial HRMS data...')

  const hashedPassword = await bcrypt.hash('admin123', 10)
  const demoUsers = [
    { email: 'admin@techbites.com', role: Role.SUPER_ADMIN, code: 'TB-001', firstName: 'System', lastName: 'Administrator' },
    { email: 'hr@techbites.com', role: Role.HR_ADMIN, code: 'TB-002', firstName: 'Hannah', lastName: 'Rafiq' },
    { email: 'lead@techbites.com', role: Role.TEAM_LEADER, code: 'TB-003', firstName: 'Liam', lastName: 'Morgan' },
    { email: 'employee@techbites.com', role: Role.EMPLOYEE, code: 'TB-004', firstName: 'Ava', lastName: 'Chen' },
  ]

  const engineeringDept = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering', description: 'Software and Technology' },
  })

  const hrDept = await prisma.department.upsert({
    where: { name: 'Human Resources' },
    update: {},
    create: { name: 'Human Resources', description: 'People & Operations' },
  })

  const leadDev = await prisma.designation.upsert({
    where: { title: 'Lead Engineer' },
    update: {},
    create: { title: 'Lead Engineer' },
  })

  await prisma.shift.upsert({
    where: { id: 'default-shift' },
    update: {},
    create: {
      id: 'default-shift',
      name: 'Regular Day Shift',
      startTime: '09:00',
      endTime: '18:00',
      graceMinutes: 15,
    },
  })

  const leaveTypes = [
    { name: 'Casual Leave', daysAllowed: 10 },
    { name: 'Sick Leave', daysAllowed: 14 },
    { name: 'Annual Leave', daysAllowed: 15 },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {},
      create: lt,
    })
  }

  const employees = []
  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: { role: demoUser.role, isActive: true },
      create: { email: demoUser.email, passwordHash: hashedPassword, role: demoUser.role },
    })
    const employee = await prisma.employee.upsert({
      where: { userId: user.id },
      update: { firstName: demoUser.firstName, lastName: demoUser.lastName },
      create: {
        employeeCode: demoUser.code,
        userId: user.id,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        joiningDate: new Date(),
        employmentType: EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
        departmentId: demoUser.role === Role.SUPER_ADMIN || demoUser.role === Role.HR_ADMIN ? hrDept.id : engineeringDept.id,
        designationId: leadDev.id,
      },
    })
    employees.push({ user, employee })
  }

  const lead = employees.find(({ user }) => user.role === Role.TEAM_LEADER)?.employee
  const member = employees.find(({ user }) => user.role === Role.EMPLOYEE)?.employee
  if (lead && member) {
    await prisma.employee.update({ where: { id: member.id }, data: { managerId: lead.id } })
  }

  const existingCycle = await prisma.appraisalCycle.findFirst({ where: { isActive: true } })
  if (!existingCycle) {
    const cycle = await prisma.appraisalCycle.create({
      data: {
        title: 'Q3 2026 Performance Review',
        period: AppraisalPeriod.QUARTERLY,
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-09-30'),
      },
    })
    const allEmployees = await prisma.employee.findMany({ select: { id: true } })
    await prisma.appraisalReview.createMany({ data: allEmployees.map(({ id }) => ({ cycleId: cycle.id, employeeId: id })) })
  }

  console.log('Seeding finished successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })