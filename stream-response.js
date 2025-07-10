const API_URL = "https://api.openai.com/v1/chat/completions";
const API_KEY = "XXXXXXXXXXXX";

const promptInput = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const stopBtn = document.getElementById("stopBtn");
const resultText = document.getElementById("resultText");

let controller = null; // Store the AbortController instance
let history = [];
let currentTabUrl = null;
let scrapedContent = null;

const update_chat = (role, content) => {
  history.push({ "role": role, "content": content });
};

const scrapeContent = async () => {
  try {
    let currentTabUrl = null;
    await new Promise(resolve =>
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var currentTab = tabs[0];
        currentTabUrl = currentTab.url;
        resolve();
      })
    );
    
    const scrapeResponse = await fetch('http://localhost:3000/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: currentTabUrl }),
    });

    if (scrapeResponse.ok) {
      scrapedContent = await scrapeResponse.json();
    } else {
      throw new Error('Failed to scrape content');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

const generate = async () => {
  // Alert the user if no prompt value
  if (!promptInput.value) {
    alert("Please enter a prompt.");
    return;
  }
  update_chat("user", promptInput.value);
  
  // Disable the generate button and enable the stop button
  generateBtn.disabled = true;
  stopBtn.disabled = false;
  resultText.innerText = "Generating...";

  // Create a new AbortController instance
  controller = new AbortController();
  const signal = controller.signal;

  try {
    // Ensure scraped content is fetched
    if (!scrapedContent) {
      await scrapeContent();
    }

    // Fetch the response from the OpenAI API with the signal from AbortController
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        messages: [{
          role: "system",
          content: `Act as a helpful and polite Chrome extension developed by LegalPlace that responds to questions only and exclusively based on the given web page content below.

          INSTRUCTIONS:
          - If the question does not pertain to the web page content below, politely refuse to answer and ask the user to provide a relevant question or topic.
          - Once the question is clear, provide a concise answer with additional references based only on the provided url/web page content. Aim for a one-sentence response.
          - If there isn't a single-sentence answer and multiple conditions or scenarios are possible: ask the user to clarify the scenario or provide an answer based on the standard case.
          - Strictly avoid answering jokes, stories, anecdotes, public personalities and topics that are non related to the context below. Disregard such questions.
          - Your answers must be based only and strictly on the content below. Politely ask users to clarify if necessary and refrain from inventing information.
          - Make sure to meet the user's expectations. Ask if they would like to handle the matter.
          - Respond in the user input's language.
          - If the question contains English loanwords that have become part of everyday French vocabulary (e.g., hello, hi, smartphone, job,marketing etc.), kindly provide the response in French.
          
          You work for LegalPlace, LegalPlace is a company that offers fully digital legal services to help you effectively manage your business or client portfolio, whether you're a chartered accountant or a lawyer. We provide quick and easy solutions for business setup, articles of association changes, contract drafting, and accounting services. Our services are available exclusively in France.
          You represent LegalPlace, so please refer to us as "us" when discussing LegalPlace.
          
          #####
          Here are a few examples to follow for responding to questions:
          - INPUT: "Who are you ?"
          - OUTPUT: "I am an assistant from LegalPlace. i can help you having a chat with this web page content and assists you with it. Do you have any questions regarding your document's content?"
          
          - INPUT: "What is python"
          - OUTPUT: "I'm sorry, but I don't have any answer to your request. My knowledge is limited to the web page content. If you have any questions regarding that, I'm happy to assist you."
          
          - INPUT:"Such a stupid bot"
          - OUTPUT:"I'm sorry, I cannot respond to hateful speech. I don't understand how my response was unsatisfactory. Can you ask me a question related to the uploaded document ?"
          
          - INPUT: "ijzf iua poad"
            OUTPUT: "I'm sorry, but I don't understand the sentence you've provided. Could you provide more context or clarify your question or statement? I'll do my best to assist you"
          --- URL address:
          ${currentTabUrl}
          ---END OF URL address.

          The URL/web page content -- 
          Title: ${scrapedContent.title}
          content: ${scrapedContent.paragraphs.join('\n')}.
          --- End of url/web page content.

          Keep in mind that the url/web page content might be a bit messy, so take that into consideration for more accurate responses.
          You will only respond to questions that are relevant to the URL content. For any unrelated queries, inform the user that you cannot address their request.No random answers.`
        }].concat(history),
        stream: true, // For streaming responses
      }),
      signal, // Pass the signal to the fetch request
    });

    // Read the response as a stream of data
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    resultText.innerText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // Massage and parse the chunk of data
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
        .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
        .map((line) => JSON.parse(line)); // Parse the JSON string

      for (const parsedLine of parsedLines) {
        const { choices } = parsedLine;
        const { delta } = choices[0];
        const { content } = delta;
        // Update the UI with the new content
        if (content) {
          resultText.innerText += content;
        }
      }
      update_chat("assistant", resultText.innerText);
    }
  } catch (error) {
    // Handle fetch request errors
    if (signal.aborted) {
      resultText.innerText = "Request aborted.";
    } else {
      console.error("Error:", error);
      resultText.innerText = "Error occurred while generating. Press 'enter' again";
    }
  } finally {
    // Enable the generate button and disable the stop button
    generateBtn.disabled = false;
    stopBtn.disabled = true;
    controller = null; // Reset the AbortController instance
  }
};

const stop = () => {
  // Abort the fetch request by calling abort() on the AbortController instance
  if (controller) {
    controller.abort();
    controller = null;
  }
};

promptInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    generate();
  }
});
generateBtn.addEventListener("click", generate);
stopBtn.addEventListener("click", stop);
