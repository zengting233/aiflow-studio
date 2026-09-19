import { ChatService } from './chat.service';

describe('ChatService', () => {
  it('routes the model selected by the client to the matching provider', async () => {
    const chatStream = jest.fn().mockImplementation(async function* () {
      yield 'hello';
      yield ' world';
    });
    const providerFactory = {
      getProviderForModel: jest.fn().mockReturnValue({ chatStream }),
    };
    const prisma = {
      chatHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const ragService = { retrieve: jest.fn() };
    const response = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    const service = new ChatService(
      prisma as any,
      ragService as any,
      providerFactory as any,
    );

    await service.chat(
      'user-1',
      { message: 'hi', model: 'qwen-plus' },
      response as any,
    );

    expect(providerFactory.getProviderForModel).toHaveBeenCalledWith(
      'qwen-plus',
    );
    expect(chatStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen-plus' }),
    );
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('hello'),
    );
    expect(response.end).toHaveBeenCalled();
  });
});
