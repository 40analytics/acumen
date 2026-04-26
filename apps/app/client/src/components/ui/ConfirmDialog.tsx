import { Dialog, DialogContent } from './Dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** 'danger' renders the confirm button in coral/destructive styling */
  variant?: 'danger' | 'default';
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'default',
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} className="max-w-[420px]">
        <div className="flex gap-2 justify-end mt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isPending}
            className={
              variant === 'danger'
                ? 'bg-coral text-white hover:bg-coral/90 border-coral'
                : undefined
            }
          >
            {isPending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
