import { zodResolver } from '@hookform/resolvers/zod';
import type { Options } from '@bh/shared/options';
import { Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { getErrorMessage, getFieldErrors } from '@/lib/error-messages';
import { useCreatePackage } from '../hooks';
import {
  requestFormSchema,
  toFormPath,
  toHolidayRequest,
  type RequestFormValues,
} from '../request-form-values';

// A new child row starts with no age, so the field is empty until the traveler types one.
const NEW_CHILD = { age: undefined } as unknown as RequestFormValues['children'][number];

/** The 7 request fields (M1). Builds a package and opens it, or says why none is possible. */
export function RequestForm({ options }: { options: Options }) {
  const navigate = useNavigate();
  const create = useCreatePackage();
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: { departureAirport: '', country: '', startDate: '', adults: 1, children: [] },
  });
  const children = useFieldArray({ control: form.control, name: 'children' });
  const { errors } = form.formState;

  function onSubmit(values: RequestFormValues) {
    create.mutate(toHolidayRequest(values), {
      onSuccess: ({ data }) => {
        if (data.status !== 'NO_PACKAGE') void navigate(`/packages/${data.packageId}`);
      },
      onError: (error) => {
        // The API checks values against the data (nights, dates). Its messages go on their fields.
        for (const field of getFieldErrors(error)) {
          form.setError(toFormPath(field.path) as FieldPath<RequestFormValues>, {
            message: field.message,
          });
        }
      },
    });
  }

  const noPackage = create.data?.data.status === 'NO_PACKAGE' ? create.data.data.reason : null;

  return (
    <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="departureAirport" label="From" error={errors.departureAirport?.message}>
          <NativeSelect
            id="departureAirport"
            aria-invalid={!!errors.departureAirport}
            {...form.register('departureAirport')}
          >
            <option value="">Choose a city</option>
            {options.departureCities.map(({ airport, city }) => (
              <option key={airport} value={airport}>
                {city} ({airport})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="country" label="To" error={errors.country?.message}>
          <NativeSelect id="country" aria-invalid={!!errors.country} {...form.register('country')}>
            <option value="">Choose a country</option>
            {options.countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="startDate" label="First day of the holiday" error={errors.startDate?.message}>
          <Input
            id="startDate"
            type="date"
            aria-invalid={!!errors.startDate}
            {...form.register('startDate')}
          />
        </Field>
        <Field id="nights" label="Nights" error={errors.nights?.message}>
          <Input
            id="nights"
            type="number"
            inputMode="numeric"
            min={1}
            aria-invalid={!!errors.nights}
            {...form.register('nights', { valueAsNumber: true })}
          />
        </Field>
        <Field id="adults" label="Adults" error={errors.adults?.message}>
          <Input
            id="adults"
            type="number"
            inputMode="numeric"
            min={1}
            aria-invalid={!!errors.adults}
            {...form.register('adults', { valueAsNumber: true })}
          />
        </Field>
        <Field id="budgetInr" label="Budget in ₹" error={errors.budgetInr?.message}>
          <Input
            id="budgetInr"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            aria-invalid={!!errors.budgetInr}
            {...form.register('budgetInr', { valueAsNumber: true })}
          />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Children</legend>
        {children.fields.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {children.fields.map((child, index) => {
              const error = errors.children?.[index]?.age?.message;
              return (
                <div key={child.id} className="w-40 space-y-2">
                  <Label htmlFor={`child-${index}`}>Age of child {index + 1}</Label>
                  <div className="flex gap-1">
                    <Input
                      id={`child-${index}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-invalid={!!error}
                      {...form.register(`children.${index}.age`, { valueAsNumber: true })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove child ${index + 1}`}
                      onClick={() => children.remove(index)}
                    >
                      <X />
                    </Button>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              );
            })}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => children.append(NEW_CHILD)}
        >
          <Plus />
          Add a child
        </Button>
      </fieldset>

      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(create.error)}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-auto" disabled={create.isPending}>
        {create.isPending ? 'Building your holiday…' : 'Build my holiday'}
      </Button>

      {noPackage && (
        <div role="alert" className="space-y-1 border-t-2 pt-6">
          <h2>We can't build this holiday</h2>
          <p>{noPackage.message}</p>
          <p className="text-muted-foreground">Change a detail above and try again.</p>
        </div>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
