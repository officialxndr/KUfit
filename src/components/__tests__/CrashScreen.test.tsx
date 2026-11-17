import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { CrashScreen } from '@/components/CrashScreen';

describe('CrashScreen', () => {
  const error = new Error('Cannot read property "kcal" of undefined');

  it('reassures the user and offers recovery', async () => {
    const retry = jest.fn(() => Promise.resolve());
    await render(<CrashScreen error={error} retry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText(/Your data is safe/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('hides the raw error until asked', async () => {
    await render(<CrashScreen error={error} retry={() => Promise.resolve()} />);
    expect(screen.queryByText(error.message)).toBeNull();
    await fireEvent.press(screen.getByText('Show details'));
    expect(screen.getByText(error.message)).toBeTruthy();
  });

  it('opens a pre-filled crash email', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await render(<CrashScreen error={error} retry={() => Promise.resolve()} />);
    await fireEvent.press(screen.getByText('Email the developer'));
    const url = String(open.mock.calls[0][0]);
    expect(url).toMatch(/^mailto:/);
    expect(decodeURIComponent(url)).toContain(error.message);
  });
});
