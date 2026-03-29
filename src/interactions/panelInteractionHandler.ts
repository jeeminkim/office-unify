import { logger } from '../../logger';

export function isMainPanelInteraction(customId: string): boolean {
  return customId.startsWith('panel:main:');
}

type PanelPayload = { content?: string; embeds?: any[]; components?: any[]; flags?: number };

export async function handleMainPanelNavigation(params: {
  interaction: any;
  customId: string;
  getTrendPanel: () => PanelPayload;
  getPortfolioPanel: () => PanelPayload;
  getFinancePanel: () => PanelPayload;
  getAIPanel: () => PanelPayload;
  getDataCenterPanel: () => PanelPayload;
  getSettingsPanel: () => PanelPayload;
  getMainPanel: () => PanelPayload;
  safeUpdate: (interaction: any, payload: PanelPayload, context: string) => Promise<void>;
}): Promise<void> {
  const { interaction, customId: cid } = params;

  logger.info('INTERACTION', 'handler branch entered', {
    interactionId: interaction.id,
    customId: interaction.customId
  });

  if (cid === 'panel:main:trend') {
    logger.info('INTERACTION', 'main trend branch start', {
      interactionId: interaction.id,
      discordUserId: interaction.user?.id
    });
    try {
      if (interaction.deferred || interaction.replied) {
        logger.warn('INTERACTION', 'main trend update skipped — already acknowledged', {
          interactionId: interaction.id,
          deferred: interaction.deferred,
          replied: interaction.replied
        });
        return;
      }
      await interaction.update(params.getTrendPanel());
      logger.info('INTERACTION', 'main trend update success', {
        interactionId: interaction.id,
        customId: interaction.customId
      });
    } catch (e: any) {
      logger.error('INTERACTION', 'main trend local catch', {
        interactionId: interaction.id,
        message: e?.message,
        code: e?.code
      });
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            ...params.getTrendPanel(),
            flags: 64
          });
        }
      } catch {
        /* ignore */
      }
    }
    logger.info('INTERACTION', 'main trend branch return', {
      interactionId: interaction.id,
      customId: interaction.customId
    });
    return;
  }

  if (cid === 'panel:main:portfolio') {
    logger.info('UI', 'portfolio panel rendered', { variant: 'main' });
    await params.safeUpdate(interaction, params.getPortfolioPanel(), 'panel:main:portfolio');
  } else if (cid === 'panel:main:finance') {
    await params.safeUpdate(interaction, params.getFinancePanel(), 'panel:main:finance');
  } else if (cid === 'panel:main:ai') {
    await params.safeUpdate(interaction, params.getAIPanel(), 'panel:main:ai');
  } else if (cid === 'panel:main:data_center') {
    await params.safeUpdate(interaction, params.getDataCenterPanel(), 'panel:main:data_center');
  } else if (cid === 'panel:main:settings') {
    await params.safeUpdate(interaction, params.getSettingsPanel(), 'panel:main:settings');
  } else if (cid === 'panel:main:reinstall') {
    await params.safeUpdate(interaction, params.getMainPanel(), 'panel:main:reinstall');
  }

  logger.info('INTERACTION', 'handler branch returning', {
    interactionId: interaction.id,
    customId: interaction.customId
  });
}
