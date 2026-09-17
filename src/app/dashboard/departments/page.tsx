import { prisma } from "@/lib/prisma";
import { createDepartment, createDesignation } from "@/app/actions/departments";
import { Building2, Briefcase, Plus, Users } from "lucide-react";

export default async function DepartmentsPage() {
  const [departments, designations] = await Promise.all([
    prisma.department.findMany({
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.designation.findMany({
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Organization Structure</h2>
        <p className="text-xs text-slate-500">Configure company divisions, teams, and job designations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Column */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold text-sm">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Create Department</span>
            </div>
            <form action={createDepartment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Department Name *</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Finance, Marketing"
                  required
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Short role of the department"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Active Departments</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {departments.length} Total
              </span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {departments.map((dept) => (
                <div key={dept.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="font-semibold text-slate-900">{dept.name}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">{dept.description || "No description provided"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{dept._count.employees} Staff</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Designation Column */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold text-sm">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <span>Create Designation</span>
            </div>
            <form action={createDesignation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Designation Title *</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Senior Product Designer, QA Specialist"
                  required
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Key responsibilities"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Designation
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Job Titles</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {designations.length} Total
              </span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {designations.map((des) => (
                <div key={des.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="font-semibold text-slate-900">{des.title}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">{des.description || "General designation"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{des._count.employees} Staff</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}