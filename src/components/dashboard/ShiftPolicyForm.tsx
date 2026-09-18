"use client";

import { startTransition, useActionState } from "react";
import { Save } from "lucide-react";
import { updateShiftConfig } from "@/app/actions/settings";
import FormField from "@/components/ui/FormField";
import { ActionFeedback, SubmitButton } from "@/components/ui/FormFeedback";
import { controlClass, readOnlyControlClass } from "@/components/ui/styles";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
}

export default function ShiftPolicyForm({ shift }: { shift: Shift }) {
  const [state, formAction, isPending] = useActionState(updateShiftConfig, null);

  return (
    <form
      // Dispatched from onSubmit rather than `action=` so a rejected save keeps the edited values instead of resetting.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      aria-busy={isPending}
      className="space-y-3 text-xs"
    >
      <input type="hidden" name="shiftId" value={shift.id} />

      <FormField label="Shift name" hint="Set when the shift is created; not editable here.">
        <input type="text" readOnly value={shift.name} className={readOnlyControlClass} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Punch-in window start" required>
          <input type="time" name="startTime" defaultValue={shift.startTime} className={controlClass} />
        </FormField>
        <FormField label="Punch-out window end" required>
          <input type="time" name="endTime" defaultValue={shift.endTime} className={controlClass} />
        </FormField>
      </div>

      <FormField
        label="Late grace window (minutes)"
        required
        hint={<>Punches more than {shift.graceMinutes} minutes after the start time are marked &ldquo;LATE&rdquo;.</>}
      >
        <input
          type="number"
          name="graceMinutes"
          min={0}
          max={120}
          step={1}
          inputMode="numeric"
          defaultValue={shift.graceMinutes}
          className={`${controlClass} tabular-nums`}
        />
      </FormField>

      <SubmitButton pending={isPending} icon={<Save className="w-3.5 h-3.5" aria-hidden />} className="w-full shadow-sm">
        Save Shift Policies
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
