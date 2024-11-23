import { Button, Frog, parseEther, TextInput } from 'frog'
import { devtools } from 'frog/dev'
// import { neynar } from 'frog/hubs'
import { handle } from 'frog/next'
import { serveStatic } from 'frog/serve-static'
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { STORY, STORY2 } from './story.js';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

const agentModel = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const getPrize = tool(() => {
  return '$RAFNFT';
}, {
  name: 'get_prize',
  description: 'Tells user what is the prize after the user gets the personality result',
})

const getPrize2 = tool(() => {
  return '$RAF';
}, {
  name: 'get_prize',
  description: 'Tells user what is the prize after the user guesses the murderer correctly',
})

const tools = [getPrize];
const tools2 = [getPrize2];
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm: agentModel,
  tools: tools,
  checkpointSaver: agentCheckpointer,
  messageModifier: new SystemMessage(STORY),
});

const agent2 = createReactAgent({
  llm: agentModel,
  tools: tools2,
  checkpointSaver: agentCheckpointer,
  messageModifier: new SystemMessage(STORY2),
});

type State = {   
  agentMsg: string,
  win: boolean,
  prize: boolean,
  threadId: string,
  gameStarted: boolean,
}

export const app = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/api',
  imageOptions: { height: 456, width: 760 },
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
  title: 'Raf MafAI',
  initialState: {
    agentMsg: 'Welcome to the Giraffe World, where towering necks hold heavy crowns. Do you wanna know which kind of Giraffe you are?',
    win: false,
    prize: false,
    threadId: '',
    gameStarted: false,
  }
})

app.frame('/', async (c) => {
  const { buttonValue, inputText, status, deriveState, previousState: pstate } = c

  const minted = pstate?.win;
  const state = await deriveState(async previousState => {
    if (minted) {
      if (!previousState.gameStarted) {
        previousState.agentMsg = "Don't leave yet! Something happened!! Solve the mystery to get more prizes!";
        previousState.threadId = new Date().getTime().toString();
      } 
      if (buttonValue === 'startGame' || inputText) {
        try {
          const humanMessage = buttonValue === 'startGame' ? new HumanMessage("Ok, Tell me who I am and what happened?") : new HumanMessage(inputText!);
          const agentFinalState = await agent2.invoke(
            { messages: [humanMessage] },
            { configurable: { thread_id: previousState.threadId } },
          );
          const content = agentFinalState.messages[agentFinalState.messages.length - 1].content;
          previousState.gameStarted = true;
          previousState.agentMsg = content;
          if (content.includes('$RAF')) {
            previousState.prize = true;
          }
        } catch (error) {
          console.error(error);
          previousState.agentMsg = 'Sorry, I am not able to respond to that.';
        }
      }
    } else {
      if (buttonValue === 'start' || inputText) {
        try {
          const humanMessage = buttonValue === 'start' ? new HumanMessage("Ok, let's start") : new HumanMessage(inputText!);
          if (buttonValue === 'start') {
            previousState.threadId = new Date().getTime().toString();
          }
          const agentFinalState = await agent.invoke(
            { messages: [humanMessage] },
            { configurable: { thread_id: previousState.threadId } },
          );
          const content = agentFinalState.messages[agentFinalState.messages.length - 1].content;
          previousState.agentMsg = content;
          if (content.includes('$RAFNFT')) {
            previousState.win = true;
          }
        } catch (error) {
          console.error(error);
          previousState.agentMsg = 'Sorry, I am not able to respond to that.';
        }
      }
    }
  })

  const wrapperStyle: any = {
    alignItems: 'flex-end',
    display: 'flex',
    height: '456px',
    width: '760px',
    backgroundSize: '100% 100%',
  }
  if (minted) {
    wrapperStyle.backgroundImage = 'url(https://images.squarespace-cdn.com/content/v1/608164c98d4fc466c981a18c/0c891230-9051-42e2-9da0-b73a5d474676/action-scene-in-movie.jpg)';
  } else {
    wrapperStyle.backgroundColor = '#A2E3F2';
  }

  return c.res({
    image: (
      <div
        style={wrapperStyle}
      >
        <img
          src={minted ? '/hitman.png' : '/accountant.png'}
          width={200}
          height={200}
          style={{
            marginBottom: '30px',
          }}
        />
        <div
          style={{
            color: 'black',
            fontSize: state.agentMsg.length > 400 ? 15 : state.agentMsg.length > 250 ? 17 : 20,
            fontWeight: 500,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            padding: '15px',
            marginRight: '50px',
            whiteSpace: 'pre-wrap',
            flex: 'auto',
            borderRadius: '16px',
            marginBottom: '100px',
            display: 'flex',
            transform: 'translateX(-30px)',
            position: 'relative',
          }}
        >
          { state.agentMsg }
          <img 
            src="/bubble.png" 
            style={{
              position: 'absolute',
              left: '-6px',
              bottom: '-3px',
              width: '40px',
              height: '22px',
              opacity: '0.8',
            }}
          />
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Your question/answer..." />,
      status !== 'initial' && <Button value="send">Send</Button>,
      status === 'initial' && <Button value="start">Yes</Button>,
      state.win && !minted && <Button.Transaction target="/send-ether">Mint Your RAF</Button.Transaction>,
      minted && !state.gameStarted && <Button value="startGame">Start Game</Button>,
      minted && state.prize && <Button.Transaction target="/send-ether">Claim Prize</Button.Transaction>
    ],
  })
})

app.transaction('/send-ether', (c) => {
  return c.send({
    chainId: 'eip155:11155111',
    to: '0x0414DDBf69294B1eE580eEf88862dEa94B726A07',
    value: parseEther('0.001'),
  })
})

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
