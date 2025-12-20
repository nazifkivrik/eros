"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"admin" | "services">("admin");
  const [loading, setLoading] = useState(false);

  // Step 1: Admin account
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Optional services
  const [qbittorrent, setQbittorrent] = useState({
    url: "http://localhost:8080",
    username: "admin",
    password: "",
    enabled: false,
  });

  const [prowlarr, setProwlarr] = useState({
    apiUrl: "http://localhost:9696",
    apiKey: "",
    enabled: false,
  });

  const [stashdb, setStashdb] = useState({
    apiUrl: "https://stashdb.org/graphql",
    apiKey: "",
    enabled: false,
  });

  const handleAdminNext = () => {
    if (!username || username.length < 3) {
      toast({
        title: "Geçersiz kullanıcı adı",
        description: "Kullanıcı adı en az 3 karakter olmalıdır",
        variant: "destructive",
      });
      return;
    }

    if (!password || password.length < 8) {
      toast({
        title: "Geçersiz şifre",
        description: "Şifre en az 8 karakter olmalıdır",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Şifreler eşleşmiyor",
        description: "Lütfen şifrenizi doğrulayın",
        variant: "destructive",
      });
      return;
    }

    setStep("services");
  };

  const handleComplete = async () => {
    setLoading(true);

    try {
      const setupData: {
        username: string;
        password: string;
        settings?: {
          qbittorrent?: typeof qbittorrent;
          prowlarr?: typeof prowlarr;
          stashdb?: typeof stashdb;
        };
      } = {
        username,
        password,
      };

      // Only include enabled services
      const hasServices =
        qbittorrent.enabled || prowlarr.enabled || stashdb.enabled;

      if (hasServices) {
        setupData.settings = {};

        if (qbittorrent.enabled) {
          setupData.settings.qbittorrent = qbittorrent;
        }

        if (prowlarr.enabled) {
          setupData.settings.prowlarr = prowlarr;
        }

        if (stashdb.enabled) {
          setupData.settings.stashdb = stashdb;
        }
      }

      await apiClient.completeSetup(setupData);

      toast({
        title: "Kurulum tamamlandı",
        description: "Uygulamaya yönlendiriliyorsunuz...",
      });

      // Redirect to login or home
      router.push("/");
    } catch (error) {
      toast({
        title: "Kurulum hatası",
        description: error instanceof Error ? error.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipServices = async () => {
    await handleComplete();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Eros Kurulumu</CardTitle>
          <CardDescription>
            {step === "admin"
              ? "Adım 1/2: Yönetici hesabı oluşturun"
              : "Adım 2/2: Harici servisleri yapılandırın (isteğe bağlı)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "admin" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                />
                <p className="text-sm text-muted-foreground">
                  En az 3 karakter olmalıdır
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <p className="text-sm text-muted-foreground">
                  En az 8 karakter olmalıdır
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Şifre (Tekrar)</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleAdminNext}>Devam Et</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Tabs defaultValue="qbittorrent" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="qbittorrent">qBittorrent</TabsTrigger>
                  <TabsTrigger value="prowlarr">Prowlarr</TabsTrigger>
                  <TabsTrigger value="stashdb">StashDB</TabsTrigger>
                </TabsList>

                <TabsContent value="qbittorrent" className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="qbit-enable"
                      checked={qbittorrent.enabled}
                      onCheckedChange={(checked) =>
                        setQbittorrent({ ...qbittorrent, enabled: !!checked })
                      }
                    />
                    <Label htmlFor="qbit-enable">qBittorrent&apos;i etkinleştir</Label>
                  </div>

                  {qbittorrent.enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="qbit-url">URL</Label>
                        <Input
                          id="qbit-url"
                          value={qbittorrent.url}
                          onChange={(e) =>
                            setQbittorrent({ ...qbittorrent, url: e.target.value })
                          }
                          placeholder="http://localhost:8080"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="qbit-username">Kullanıcı Adı</Label>
                        <Input
                          id="qbit-username"
                          value={qbittorrent.username}
                          onChange={(e) =>
                            setQbittorrent({ ...qbittorrent, username: e.target.value })
                          }
                          placeholder="admin"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="qbit-password">Şifre</Label>
                        <Input
                          id="qbit-password"
                          type="password"
                          value={qbittorrent.password}
                          onChange={(e) =>
                            setQbittorrent({ ...qbittorrent, password: e.target.value })
                          }
                          placeholder="••••••••"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="prowlarr" className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="prowlarr-enable"
                      checked={prowlarr.enabled}
                      onCheckedChange={(checked) =>
                        setProwlarr({ ...prowlarr, enabled: !!checked })
                      }
                    />
                    <Label htmlFor="prowlarr-enable">Prowlarr&apos;ı etkinleştir</Label>
                  </div>

                  {prowlarr.enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="prowlarr-url">API URL</Label>
                        <Input
                          id="prowlarr-url"
                          value={prowlarr.apiUrl}
                          onChange={(e) =>
                            setProwlarr({ ...prowlarr, apiUrl: e.target.value })
                          }
                          placeholder="http://localhost:9696"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prowlarr-key">API Key</Label>
                        <Input
                          id="prowlarr-key"
                          type="password"
                          value={prowlarr.apiKey}
                          onChange={(e) =>
                            setProwlarr({ ...prowlarr, apiKey: e.target.value })
                          }
                          placeholder="API anahtarınızı girin"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="stashdb" className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stashdb-enable"
                      checked={stashdb.enabled}
                      onCheckedChange={(checked) =>
                        setStashdb({ ...stashdb, enabled: !!checked })
                      }
                    />
                    <Label htmlFor="stashdb-enable">StashDB&apos;yi etkinleştir</Label>
                  </div>

                  {stashdb.enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="stashdb-url">API URL</Label>
                        <Input
                          id="stashdb-url"
                          value={stashdb.apiUrl}
                          onChange={(e) =>
                            setStashdb({ ...stashdb, apiUrl: e.target.value })
                          }
                          placeholder="https://stashdb.org/graphql"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stashdb-key">API Key</Label>
                        <Input
                          id="stashdb-key"
                          type="password"
                          value={stashdb.apiKey}
                          onChange={(e) =>
                            setStashdb({ ...stashdb, apiKey: e.target.value })
                          }
                          placeholder="API anahtarınızı girin"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("admin")}>
                  Geri
                </Button>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleSkipServices}
                    disabled={loading}
                  >
                    Atla
                  </Button>
                  <Button onClick={handleComplete} disabled={loading}>
                    {loading ? "Yükleniyor..." : "Kurulumu Tamamla"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
