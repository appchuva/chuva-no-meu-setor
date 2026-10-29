# Chuva no meu setor — memória do projeto

> Este arquivo é **público** (vai para o GitHub). Informações pessoais do usuário ficam em
> `CLAUDE.local.md`, que só existe no notebook dele e está no `.gitignore`. Leia os dois.

## Quem usa e como falar com o usuário

- O usuário é um **oficial de justiça** do DF. Detalhes pessoais: `CLAUDE.local.md`.
- **Não é programador.** Fale sempre em **português do Brasil**, em linguagem simples.
- Explique cada termo técnico numa frase. Explique **o porquê antes do como**.
- Trabalhe em **passos pequenos e testáveis**. Ao fim de cada etapa, diga exatamente como ele confere se funcionou: passos numerados, **um clique por vez**.
- Use o nome dele ou they/them; não presuma pronomes.
- **Peça a confirmação dele antes de publicar qualquer coisa na internet** (GitHub Pages, Cloudflare etc.).
- **Nunca coloque informação pessoal em arquivos que vão para o GitHub** (nome, endereço, lotação, descrição do setor dele, e-mail).

## O problema

Oficiais de justiça cumprem mandados de carro pelo setor. O que mais atrapalha é a **chuva**: mandado é papel, e é difícil segurar o mandado e o guarda-chuva ao mesmo tempo. A pergunta que o app responde: **"vai chover enquanto eu estiver na rua, e em que parte do setor?"**. Temperatura importa menos.

- Temporais do DF: temporada de **outubro a abril**, fortes, **à tarde** e bem localizados.
- **Honestidade na interface:** a previsão mostra tendência, não acerta rua por rua. Os modelos têm resolução de vários km (ver "Dados" abaixo).

## Decisões tomadas

- **Nome:** "Chuva no meu setor".
- **Formato:** app web instalável (PWA = página que o Chrome do Android oferece "Adicionar à tela inicial"). HTML + CSS + JavaScript simples, **sem etapa de build**. Nada de app Android nativo por enquanto (widget na tela inicial fica para o futuro, se colegas pedirem).
- **Hospedagem:** **GitHub Pages** gratuito (repositório público), conta neutra criada só para o app. Para testar no notebook: `Abrir o app.bat` (servidor local de dois cliques, precisa de Python).
- **Dados de previsão:** Open-Meteo (gratuito, sem cadastro/chave). Uso não comercial; limite 10.000 chamadas/dia por IP. Exige o crédito "Dados do tempo: Open-Meteo.com" com link, perto de onde os dados aparecem (licença CC BY 4.0).
- **Mapa:** Leaflet + OpenStreetMap (com atribuição; respeitar a política de uso dos tiles: não baixar tiles em massa nem guardá-los no service worker). O oficial desenha o setor como **polígono** (ou marca um **ponto**, ex.: "Casa"). Vários lugares por pessoa ("Meu setor", "Casa", "Fórum"). Pensado para oficiais de qualquer fórum.
- **Pior caso do setor:** o app espalha pontos de previsão dentro do polígono, mostra o pior caso e destaca no mapa a parte mais arriscada.
- **Privacidade:** desenhos só no aparelho (localStorage), sem conta, senha ou servidor próprio. Só saem do aparelho as coordenadas dos pontos (para o Open-Meteo) e os pedidos de pedaços do mapa (para o OpenStreetMap). Futuro: compartilhar um setor com colegas por link.
- **Horários:** **não perguntar o turno.** A tela abre a partir de AGORA ("Próximas horas" em destaque), depois o resto do dia e a noite (fundo escuro). Atalhos de um toque: Manhã · Tarde · Noite · Amanhã. Noite e fim de semana cobertos (há plantão). Próximos dias abaixo.
- **Atualização:** ao abrir e a cada 10 minutos enquanto aberto. Explicar que o dado só muda quando o serviço atualiza (conforme o modelo, de 1 em 1 hora até de 6 em 6 horas).
- **Falhas:** se o Open-Meteo não responder (limite de 20 s) ou der erro, a tela diz o motivo em palavras simples e mantém a última previsão guardada.
- **Não usar logo nem nome de tribunal** (não pode parecer app oficial).
- **Segunda etapa (ainda NÃO fazer):** aviso/notificação push ("vai chover no setor em 1 hora"), que exige um pequeno servidor.

## Pendências

- **Publicar no GitHub Pages** e testar no celular: etapa em andamento. Antes do primeiro envio, siga a seção "Antes do PRIMEIRO envio ao GitHub" do `CLAUDE.local.md`.
- **Teste num computador do fórum**, depois da publicação. Roteiro: `docs/teste-no-forum.md`.
- Ideias futuras: salvar/abrir o setor num arquivo ou por link (útil se computadores corporativos apagarem os dados do navegador); radar de chuva (pesquisar fonte gratuita e liberada para o DF).

## Dados: o que o Open-Meteo oferece para o Brasil (conferido em 29/10/2026)

- O Brasil usa só **modelos globais** (ECMWF IFS ~9 km, DWD ICON ~11–13 km, NOAA GFS ~13–25 km). Não há modelo regional de alta resolução.
- **Não há dado nativo de 15 em 15 minutos** para o Brasil (só América do Norte e Europa Central). O `minutely_15` aqui é só a previsão horária interpolada, por isso o app usa a **previsão horária**.
- `precipitation_probability` vem de ensembles com ~27 km de resolução. `precipitation` (mm na hora anterior) e `weather_code` (95–99 = trovoada) vêm dos modelos determinísticos.
- Vários pontos podem cair na mesma célula do modelo; o app junta pontos repetidos. Num setor pequeno, a diferença entre partes pode ser nula — a interface diz isso.
- Uma requisição aceita várias coordenadas separadas por vírgula (a resposta vira lista).

## Estrutura

- `index.html`: página única (telas "Previsão" e "Meus lugares").
- `css/app.css`: estilos.
- `js/`: `store.js` (lugares no aparelho), `geo.js` (pontos dentro do polígono), `forecast.js` (Open-Meteo e cálculo do pior caso), `mapa.js` (desenhar, mudar forma, mover), `previsao.js` (tela de previsão), `app.js` (junta tudo).
- `vendor/leaflet/`: Leaflet 1.9.4 copiado localmente.
- `manifest.webmanifest`, `sw.js`, `icons/`: para instalar no Android.
- `Abrir o app.bat` + `servidor.py`: servidor local em http://localhost:8080.
- `docs/teste-no-forum.md`: roteiro de teste num computador corporativo.
- Ao mudar arquivos do app, aumente `VERSAO` em `sw.js` para o celular pegar a versão nova.
