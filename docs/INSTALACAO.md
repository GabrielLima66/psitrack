# Instalando o PsiTrack

Passo a passo para instalar o PsiTrack num computador Windows pela primeira vez.

## Requisitos

- Windows 10 ou 11, 64 bits.
- Não precisa de internet para instalar nem para usar — o PsiTrack é 100% local
  e nunca faz nenhuma chamada de rede.

## 1. Baixar e rodar o instalador

O arquivo se chama `PsiTrack-{versão}-setup.exe` (por exemplo,
`PsiTrack-0.0.1-setup.exe`). Dê dois cliques para rodar.

### O aviso do Windows SmartScreen

Na primeira execução, o Windows provavelmente vai mostrar uma tela azul
dizendo **"O Windows protegeu o computador"**. Isso acontece porque o
instalador ainda não tem um certificado de assinatura de código — não é
sinal de vírus, é só o Windows sendo cauteloso com qualquer programa novo
sem assinatura, mesmo os legítimos.

Para prosseguir:
1. Clique em **"Mais informações"** (o texto em cinza, menor).
2. Clique no botão **"Executar assim mesmo"** que aparece depois.

## 2. Escolher onde instalar

O instalador deixa escolher a pasta de instalação e cria atalho na área de
trabalho e no menu iniciar automaticamente.

## 3. Abrir o PsiTrack pela primeira vez

Na primeira abertura, o app vai pedir para **criar uma senha mestra**. Depois
de criada, ele mostra uma **recovery key** — uma sequência de palavras/códigos
que é a única forma de recuperar o acesso caso a senha seja esquecida.

**Guarde a recovery key em um lugar seguro, fora do computador** (papel,
gerenciador de senhas, etc.). Sem ela e sem a senha, os dados ficam
permanentemente inacessíveis — não existe "recuperar senha" nenhum outro
jeito, de propósito: é assim que os dados clínicos ficam protegidos mesmo se
o computador for roubado.

## 4. Onde os dados ficam guardados

Tudo o que o PsiTrack grava fica em:

```
%APPDATA%\PsiTrack\
```

(normalmente `C:\Users\<seu usuário>\AppData\Roaming\PsiTrack\`)

Dentro dessa pasta:
- `psitrack.db` — o banco de dados cifrado (pacientes, prontuário, agenda, financeiro).
- `keys.json` — o envelope da senha mestra. **Necessário junto com o banco** — um
  não abre sem o outro.
- `anexos\` — os documentos anexados, cifrados individualmente.
- `backups\` — os backups manuais criados pela tela Configurações.

## 5. Desinstalando

Pelo Painel de Controle ou Configurações do Windows → Aplicativos, como
qualquer programa.

**Desinstalar o PsiTrack não apaga a pasta `%APPDATA%\PsiTrack\`.** Os dados
clínicos continuam no computador depois da desinstalação — isso é
intencional, para que uma desinstalação acidental (ou uma reinstalação, ou
uma atualização feita por fora reinstalando do zero) nunca resulte em perda
de prontuário. Se um dia for necessário apagar os dados de vez (por exemplo,
ao trocar de computador em definitivo, depois de já ter migrado o backup),
isso é uma ação manual e separada: apagar a pasta `%APPDATA%\PsiTrack\` à
mão, com certeza de que já existe uma cópia de segurança em outro lugar.

## Atualizando para uma versão nova

Não existe atualização automática (nunca vai existir — é uma decisão de
projeto, para o app nunca precisar de rede). Para atualizar, baixe o novo
instalador e rode-o como da primeira vez; a instalação por cima preserva o
banco, os anexos e os backups. A versão instalada aparece em
**Configurações → Sobre**, dentro do app.
