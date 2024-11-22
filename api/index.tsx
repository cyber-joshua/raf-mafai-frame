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
import { STORY } from './story.js';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

const agentModel = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});

const getPrize = tool(() => {
  return '$RAF'
}, {
  name: 'get_prize',
  description: 'Tells user what is the prize after the user successfully guesses the murderer',
})

const tools = [getPrize];
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm: agentModel,
  tools: tools,
  checkpointSaver: agentCheckpointer,
  messageModifier: new SystemMessage(STORY),
});

type State = {   
  agentMsg: string,
  win: boolean,
}

export const app = new Frog<{ State: State }>({
  assetsPath: '/',
  basePath: '/api',
  imageOptions: { height: 760, width: 456 },
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
  title: 'Raf MafAI',
  initialState: {
    agentMsg: 'Welcome to the Giraffe World, where towering necks hold heavy crowns. Before we begin, let me ask—were you the runt of your pack, or were you always standing tall?',
    win: false
  }
})

app.frame('/', async (c) => {
  const { buttonValue, inputText, status, deriveState } = c

  const state = await deriveState(async previousState => {
    if (buttonValue === 'start' || inputText) {
      try {
        const humanMessage = buttonValue === 'start' ? new HumanMessage("Ok, let us play the game, tell me who I am and what happend?") : new HumanMessage(inputText!);
        const agentFinalState = await agent.invoke(
          { messages: [humanMessage] },
          { configurable: { thread_id: '5' } },
        );
        const content = agentFinalState.messages[agentFinalState.messages.length - 1].content;
        previousState.agentMsg = content;
        if (content.includes('$RAF')) {
          previousState.win = true;
        }
      } catch (error) {
        console.error(error);
        previousState.agentMsg = 'Sorry, I am not able to respond to that.';
      }
    }
  })

  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          position: 'relative',
          display: 'flex',
          height: '100%',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        <img
          src='/raf.png'
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
        <div
          style={{
            color: 'black',
            fontSize: state.agentMsg.length > 400 ? 9 : 11,
            fontWeight: 500,
            backgroundColor: 'white',
            padding: '15px',
            whiteSpace: 'pre-wrap',
            width: '250px',
            borderRadius: '16px',
            transform: 'translateX(80px)',
          }}
        >
          { state.agentMsg }
        </div>
        <img 
          src='/bubble.svg'
          width={112}
          height={57}
          style={{
            position: 'absolute',
            left: '220px',
            transform: 'translateX(-200px)',
          }}
        />
      </div>
    ),
    intents: [
      <TextInput placeholder="Your question/answer..." />,
      <Button value="send">Send</Button>,
      status === 'initial' && <Button value="start">Start</Button>,
      state.win && <Button.Transaction target="/send-ether">Claim Prize</Button.Transaction>,
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
