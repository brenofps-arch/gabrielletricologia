# Íris: colocando a ponte do WhatsApp (Evolution API) no ar, de graça

Resultado: um servidor gratuito da Oracle, ligado 24h, rodando a Evolution API.
O sistema (Supabase) conversa com ela por HTTPS.

> Tempo estimado: 40 a 60 minutos. Você precisa de um cartão (só para verificar o cadastro).

## Parte 1 — Conta e servidor na Oracle (feito por você)

1. Entre em **cloud.oracle.com** e crie uma conta "Always Free". Escolha a região **Brasil (São Paulo)** ou **Vinhedo**.
   O cartão é só para verificação. Fique **somente em recursos "Always Free"**.
2. No console: **Compute → Instances → Create instance**.
   - **Image:** Ubuntu 22.04 (ou 24.04).
   - **Shape:** *Ampere (ARM)* **VM.Standard.A1.Flex** com **1 OCPU e 6 GB** (sobra para a Evolution).
   - **Networking:** deixe criar uma rede nova e marque **Assign a public IPv4 address**.
   - **SSH keys:** *Generate a key pair* e **baixe a chave privada** (`.key`). Guarde bem.
3. Se aparecer "Out of capacity", tente outro horário, outra região ou outro "availability domain". É comum.
4. Quando a instância estiver *Running*, anote o **IP público**.

### Liberar as portas 80 e 443
1. Na instância: **Subnet → Security List → Add Ingress Rules**.
2. Crie duas regras: origem `0.0.0.0/0`, protocolo TCP, porta de destino **80**, e outra com **443**.

## Parte 2 — Instalar o Docker no servidor

No seu computador (Windows), no PowerShell, conecte (troque pelo caminho da chave e pelo IP):

```
ssh -i C:\caminho\chave.key ubuntu@IP_PUBLICO
```

Já dentro do servidor:

```
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
exit
```

Entre de novo por SSH (para o grupo `docker` valer).

## Parte 3 — Subir a Evolution API

1. Copie a pasta `deploy/evolution` deste projeto para o servidor (por exemplo com `scp`) ou crie os arquivos lá com o mesmo conteúdo.
2. Dentro da pasta:

```
cp .env.example .env
nano .env       # preencha EVOLUTION_DOMAIN, EVOLUTION_API_KEY e POSTGRES_PASSWORD
docker compose --profile servidor up -d
docker compose ps
```

Em `EVOLUTION_DOMAIN` use `SEU.IP.PUBLICO.sslip.io` (ex.: `129.146.10.20.sslip.io`).
Teste no navegador: `https://SEU.IP.PUBLICO.sslip.io` deve mostrar uma resposta da Evolution API.

## Parte 4 — Conectar o WhatsApp e ligar ao sistema

(Os comandos abaixo usam `curl`; podem ser executados no servidor ou no seu PowerShell com `curl.exe`.)

1. **Criar a instância** (troque a chave e o domínio):

```
curl -X POST https://DOMINIO/instance/create -H "apikey: SUA_CHAVE" -H "Content-Type: application/json" -d '{"instanceName":"iris","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

2. **Ler o QR code:** abra `https://DOMINIO/manager`, entre com a chave, escolha a instância `iris` e escaneie o QR com o WhatsApp do consultório (Aparelhos conectados → Conectar um aparelho).
3. **Apontar o webhook para o sistema:**

```
curl -X POST https://DOMINIO/webhook/set/iris -H "apikey: SUA_CHAVE" -H "Content-Type: application/json" -d '{"webhook":{"enabled":true,"url":"https://byhcxufglzjztiqfcleh.supabase.co/functions/v1/whatsapp-webhook","events":["MESSAGES_UPSERT"]}}'
```

4. **No Supabase** (Edge Functions → Secrets), defina:
   - `EVOLUTION_API_URL` = `https://DOMINIO`
   - `EVOLUTION_API_KEY` = a mesma chave do `.env`
   - `EVOLUTION_INSTANCE_NAME` = `iris`
   - `IRIS_ADMIN_GROUP_JID` = identificador do grupo (veja abaixo)
5. **Implantar as funções** `whatsapp-webhook` e `iris-daily-list` e criar o agendador (SQL na conversa).

### Como descobrir o identificador do grupo
Mande uma mensagem no grupo "AGENDAMENTO ROBÔ" e olhe os registros da função `whatsapp-webhook` no Supabase (Edge Functions → Logs).
O campo `remoteJid` termina em `@g.us`; esse valor inteiro é o `IRIS_ADMIN_GROUP_JID`.

## Cuidados

- **Não ultrapasse os recursos "Always Free"** da Oracle nem faça upgrade do plano sem querer.
- A Oracle pode **recolher instâncias gratuitas muito ociosas**. Se isso acontecer, é só recriar e subir de novo; os dados da Íris ficam no Supabase.
- Faça **backup** do arquivo `.env` (sem ele não dá para reconectar).
- Use o WhatsApp **só para a equipe**, com pouco volume, para reduzir o risco de bloqueio do número.
