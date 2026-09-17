import { PrismaClient, Role, EmploymentType, EmployeeStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding initial HRMS data...')

  // ১. ডিফল্ট সুপার অ্যাডমিন ইউজার
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@techbites.com' },
    update: {},
    create: {
      email: 'admin@techbites.com',
      passwordHash: hashedPassword,
      role: Role.SUPER_ADMIN,
    },
  })

  // ২. ডিপার্টমেন্টস
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

  // ৩. ডেজিগনেশন
  const leadDev = await prisma.designation.upsert({
    where: { title: 'Lead Engineer' },
    update: {},
    create: { title: 'Lead Engineer' },
  })

  // ৪. রেগুলার অফিস শিফট
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

  // ৫. স্ট্যান্ডার্ড লিভ টাইপস
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

  // ৬. অ্যাডমিন প্রোফাইল লিংক
  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      employeeCode: 'TB-001',
      userId: adminUser.id,
      firstName: 'System',
      lastName: 'Administrator',
      joiningDate: new Date(),
      employmentType: EmploymentType.FULL_TIME,
      status: EmployeeStatus.ACTIVE,
      departmentId: hrDept.id,
      designationId: leadDev.id,
    },
  })

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