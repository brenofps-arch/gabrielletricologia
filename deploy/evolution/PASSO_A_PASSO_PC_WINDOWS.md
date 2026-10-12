# Íris no PC do consultório (Windows), de graça

Resultado: a Evolution API roda no computador do consultório e o sistema (Supabase) fala com ela por um endereço
público e gratuito do Tailscale.

> **Limite:** com o PC desligado das 19h às 9h, a Íris não responde nesse período.
> Por isso a lista das consultas sai às **18h30** (antes de desligar), com uma segunda tentativa às 9h30.

Tempo estimado: 40 a 60 minutos.

## Antes de começar

- Windows 10/11 e conta de administrador.
- E-mail para criar a conta gratuita do Tailscale.
- O celular com o WhatsApp do consultório em mãos (para ler o QR code).

## Parte 1 — Programas

1. **Docker Desktop**: baixe em docker.com/products/docker-desktop e instale (reinicie o PC se pedir).
   Abra o Docker Desktop → *Settings → General* e marque **"Start Docker Desktop when you sign in"**.
2. **Tailscale**: baixe em tailscale.com/download e instale. Entre com uma conta (Google/Microsoft).

## Parte 2 — Impedir que o PC "durma"

*Configurações → Sistema → Energia*: em "Quando conectado, suspender após" escolha **Nunca**.
(Assim ele não suspende durante o dia. À noite pode desligar normalmente.)

## Parte 3 — Subir a Evolution API

1. Copie a pasta `deploy/evolution` deste projeto para o PC (por exemplo, `C:\iris\evolution`).
2. Na pasta, copie `.env.example` para `.env` e abra no Bloco de Notas:
   - `EVOLUTION_API_KEY`: uma senha longa (use um gerador de senhas).
   - `POSTGRES_PASSWORD`: outra senha forte.
   - `EVOLUTION_DOMAIN`: deixe em branco por enquanto (você preenche na Parte 4).
3. No PowerShell, dentro da pasta:

```
docker compose up -d
docker compose ps
```

Os 3 serviços (evolution, postgres, redis) devem aparecer como *running*.
Teste: abra `http://localhost:8080` no navegador; deve aparecer uma resposta da Evolution API.

## Parte 4 — Endereço público (Tailscale Funnel)

1. No PowerShell:

```
tailscale funnel --bg 8080
```

Se o Tailscale reclamar que o Funnel/HTTPS não está habilitado, ele mostra um link para ativar no painel. Aceite.

2. O comando mostra um endereço parecido com `https://nome-do-pc.xxxx.ts.net`.
   Copie o endereço **sem** `https://` e cole em `EVOLUTION_DOMAIN` no `.env`. Depois reinicie:

```
docker compose up -d
```

3. Teste de fora (pelo celular em 4G): abra `https://nome-do-pc.xxxx.ts.net`.

## Parte 5 — Conectar o WhatsApp e ligar ao sistema

(Troque `DOMINIO` e `SUA_CHAVE` pelos seus valores.)

1. **Criar a instância**:

```
curl.exe -X POST https://DOMINIO/instance/create -H "apikey: SUA_CHAVE" -H "Content-Type: application/json" -d "{\"instanceName\":\"iris\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}"
```

2. **QR code**: abra `https://DOMINIO/manager`, entre com a chave, escolha `iris` e leia o QR com o WhatsApp do consultório
   (*Aparelhos conectados → Conectar um aparelho*).
3. **Webhook**:

```
curl.exe -X POST https://DOMINIO/webhook/set/iris -H "apikey: SUA_CHAVE" -H "Content-Type: application/json" -d "{\"webhook\":{\"enabled\":true,\"url\":\"https://byhcxufglzjztiqfcleh.supabase.co/functions/v1/whatsapp-webhook\",\"events\":[\"MESSAGES_UPSERT\"]}}"
```

4. **Segredos no Supabase** (Edge Functions → Secrets):
   `EVOLUTION_API_URL` = `https://DOMINIO`, `EVOLUTION_API_KEY` = sua chave, `EVOLUTION_INSTANCE_NAME` = `iris`,
   `IRIS_ADMIN_GROUP_JID` = identificador do grupo (veja abaixo).
5. **Implantar** as funções `whatsapp-webhook` e `iris-daily-list` e rodar a migração `20261012180000_iris_job_runs.sql`.

### Agendador (SQL Editor do Supabase)

```sql
-- 18h30 de Brasília = 21h30 UTC: lista de amanhã
select cron.schedule('iris-list-evening', '30 21 * * *', $$
  select net.http_post(
    url := 'https://byhcxufglzjztiqfcleh.supabase.co/functions/v1/iris-daily-list?target=tomorrow',
    headers := '{"Content-Type":"application/json"}'::jsonb) $$);

-- 9h30 de Brasília = 12h30 UTC: lista de hoje, só se a das 18h30 não saiu
select cron.schedule('iris-list-morning', '30 12 * * *', $$
  select net.http_post(
    url := 'https://byhcxufglzjztiqfcleh.supabase.co/functions/v1/iris-daily-list?target=today',
    headers := '{"Content-Type":"application/json"}'::jsonb) $$);
```

### Como descobrir o identificador do grupo
Escreva no grupo "AGENDAMENTO ROBÔ" e veja os registros (*Logs*) da função `whatsapp-webhook` no Supabase.
O `remoteJid` terminado em `@g.us` é o valor de `IRIS_ADMIN_GROUP_JID`.

## No dia a dia

- Ao ligar o PC, o Docker Desktop abre sozinho e os serviços voltam (`restart: unless-stopped`).
  Não precisa ler o QR code de novo, salvo se ficar mais de ~14 dias desligado.
- Se algo parar, abra o Docker Desktop e confira se os 3 serviços estão *running*.
- Faça uma cópia do `.env`: sem ele não dá para reconectar.
- Uso do WhatsApp por biblioteca não oficial tem risco de bloqueio do número; mantenha só com a equipe.
