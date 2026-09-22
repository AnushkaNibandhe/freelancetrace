import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface UnassignButtonProps {
  projectId: number;
  freelancerName: string;
  onSuccess: () => void;
}

export function UnassignButton({ projectId, freelancerName, onSuccess }: UnassignButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleUnassign = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(`/projects/${projectId}/unassign`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed to unassign freelancer");
      }

      toast({
        title: "Freelancer unassigned",
        description: `${freelancerName} has been removed from this project.`,
      });

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast({
        title: "Unassignment failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Unassign Freelancer</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unassign Freelancer</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unassign <strong>{freelancerName}</strong> from this project?
            This will reset the project status to open and notify the freelancer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleUnassign();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unassigning…
              </>
            ) : (
              "Unassign"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
