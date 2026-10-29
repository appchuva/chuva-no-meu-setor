# Teste do app num computador do fórum

**Quando:** num computador corporativo (de um fórum ou tribunal), depois que o app estiver publicado.
**Antes de testar:** o app precisa estar publicado na internet (GitHub Pages ou Cloudflare Pages). O `Abrir o app.bat` NÃO serve para isso, porque precisa do Python instalado.

Objetivo: saber se um oficial de justiça consegue usar o app num computador do tribunal, sem instalar nada.

## Passo a passo (cerca de 5 minutos)

1. No computador do fórum, abra o **Chrome** ou o **Edge**.
2. Digite o endereço do app publicado e aperte Enter.
3. **O app abriu?** Anote: sim / não (se não, anote a mensagem que apareceu).
4. Clique em **Meus lugares**. **O mapa apareceu** (ruas e nomes de bairros)? Anote: sim / não / fundo cinza.
5. Clique em **+ Desenhar área** e desenhe um setor pequeno com 3 ou 4 cantos. Clique em **Concluir** e depois em **Salvar**.
6. Clique em **Previsão**. **Apareceu a previsão** (resumo colorido e a lista de horas com porcentagens)? Anote: sim / não (se não, anote a mensagem amarela).
7. Feche o navegador inteiro. Abra de novo e volte ao endereço do app. **O setor desenhado continua lá?** Anote: sim / não.
8. (Opcional) No canto da barra de endereço, veja se aparece o ícone **"Instalar app"**. Anote: sim / não.
9. Tire uma foto ou captura de tela de qualquer erro.

## Como ler o resultado

| O que aconteceu | Provável causa | O que fazer |
|---|---|---|
| Passo 3 falhou | A rede bloqueia o endereço do app (github.io ou pages.dev) | Pedir à TI a liberação do endereço |
| Passo 4 com fundo cinza | A rede bloqueia o mapa (`tile.openstreetmap.org`) | Pedir à TI a liberação |
| Passo 6 falhou | A rede bloqueia a previsão (`api.open-meteo.com`) | Pedir à TI a liberação |
| Passo 7 falhou | O computador apaga os dados dos sites ao fechar o navegador | Criar no app a opção de salvar/abrir o setor num arquivo ou por link |

Se algo for bloqueado, o Claude prepara um texto curto para a TI com os endereços a liberar. Lembrar também de confirmar se há alguma norma interna sobre usar apps não oficiais em equipamento do tribunal.

## Resultado (preencher depois do teste)

- Data:
- Navegador:
- Passos que funcionaram:
- Passos que falharam:
