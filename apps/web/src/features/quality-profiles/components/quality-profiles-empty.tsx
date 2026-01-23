import { Card, CardContent } from "@/components/ui/card";

export function QualityProfilesEmpty() {
  return (
    <Card>
      <CardContent className="text-center p-8">
        <p className="text-muted-foreground">
          No quality profiles yet. Create one to get started.
        </p>
      </CardContent>
    </Card>
  );
}
