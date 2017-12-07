'use strict';
import { $ } from 'meteor/jquery';
import { _ } from 'meteor/underscore';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { dbArena } from '/db/dbArena';
import { dbArenaFighters, getAttributeNumber } from '/db/dbArenaFighters';
import { dbArenaLog } from '/db/dbArenaLog';
import { inheritedShowLoadingOnSubscribing } from '../layout/loading';
import { shouldStopSubscribe } from '../utils/idle';

const rDisplayPanelList = new ReactiveVar(['fighterList']);
inheritedShowLoadingOnSubscribing(Template.arenaInfo);
Template.arenaInfo.onCreated(function() {
  this.autorun(() => {
    if (shouldStopSubscribe()) {
      return false;
    }
    const arenaId = FlowRouter.getParam('arenaId');
    if (arenaId) {
      this.subscribe('arenaInfo', arenaId);
      this.subscribe('adjacentArena', arenaId);
    }
  });
});
Template.arenaInfo.helpers({
  arenaData() {
    const arenaId = FlowRouter.getParam('arenaId');
    const arenaData = dbArena.findOne(arenaId);
    //更換大賽資訊，自動依據大賽是否已過期來重設選手排列依據
    if (arenaData) {
      if (Date.now() > arenaData.endDate) {
        rFighterSortBy.set('winnerIndex');
        rFighterSortDir.set(1);
      }
      else {
        rFighterSortBy.set('agi');
        rFighterSortDir.set(-1);
      }
    }

    return arenaData;
  },
  nowIsBeforeTimeOf(date) {
    return date ? (Date.now() <= date.getTime()) : false;
  },
  isDisplayPanel(panelType) {
    return _.contains(rDisplayPanelList.get(), panelType);
  }
});
Template.arenaInfo.events({
  'click [data-toggle-panel]'(event) {
    event.preventDefault();
    const $emitter = $(event.currentTarget);
    const panelType = $emitter.attr('data-toggle-panel');
    const displayPanelList = rDisplayPanelList.get();
    if (_.contains(displayPanelList, panelType)) {
      rDisplayPanelList.set(_.without(displayPanelList, panelType));
    }
    else {
      displayPanelList.push(panelType);
      rDisplayPanelList.set(displayPanelList);
    }
  }
});

Template.arenaInfoNav.helpers({
  arenaLinkAttrs(linkType) {
    const arenaId = FlowRouter.getParam('arenaId');
    const currentArenaData = dbArena.findOne(arenaId);

    if (currentArenaData) {
      switch (linkType) {
        case 'prev': {
          const navArenaData = dbArena.findOne(
            {
              beginDate: {
                $lt: currentArenaData.beginDate
              }
            },
            {
              sort: {
                beginDate: -1
              }
            }
          );
          if (navArenaData) {
            return {
              'class': 'btn btn-info btn-sm float-left',
              'href': FlowRouter.path('arenaInfo', {
                arenaId: navArenaData._id
              })
            };
          }
          else {
            return {
              'class': 'btn btn-info btn-sm float-left disabled',
              'href': FlowRouter.path('arenaInfo', {arenaId})
            };
          }
        }
        case 'next': {
          const navArenaData = dbArena.findOne(
            {
              beginDate: {
                $gt: currentArenaData.beginDate
              }
            },
            {
              sort: {
                beginDate: 1
              }
            }
          );
          if (navArenaData && navArenaData._id !== arenaId) {
            return {
              'class': 'btn btn-info btn-sm float-right',
              'href': FlowRouter.path('arenaInfo', {
                arenaId: navArenaData._id
              })
            };
          }
          else {
            return {
              'class': 'btn btn-info btn-sm float-right disabled',
              'href': FlowRouter.path('arenaInfo', {arenaId})
            };
          }
        }
      }
    }
  },
  arenaBegin() {
    const arenaId = FlowRouter.getParam('arenaId');
    const currentArenaData = dbArena.findOne(arenaId);

    return currentArenaData ? currentArenaData.beginDate : null;
  },
  arenaEnd() {
    const arenaId = FlowRouter.getParam('arenaId');
    const currentArenaData = dbArena.findOne(arenaId);

    return currentArenaData ? currentArenaData.endDate : null;
  }
});

const rFighterSortBy = new ReactiveVar('');
const rFighterSortDir = new ReactiveVar(-1);
Template.arenaFighterTable.onCreated(function() {
  if (Date.now() > this.data.endDate) {
    rFighterSortBy.set('winnerIndex');
    rFighterSortDir.set(1);
  }
  else {
    rFighterSortBy.set('agi');
    rFighterSortDir.set(-1);
  }
});
Template.arenaFighterTable.onRendered(function() {
  if (Date.now() > this.data.endDate) {
    rFighterSortBy.set('winnerIndex');
    rFighterSortDir.set(1);
  }
  else {
    rFighterSortBy.set('agi');
    rFighterSortDir.set(-1);
  }
});
Template.arenaFighterTable.helpers({
  getSortIcon(fieldName) {
    if (fieldName === rFighterSortBy.get()) {
      if (rFighterSortDir.get() === -1) {
        return `<i class="fa fa-sort-amount-desc" aria-hidden="true"></i>`;
      }
      else {
        return `<i class="fa fa-sort-amount-asc" aria-hidden="true"></i>`;
      }
    }

    return '';
  },
  fighterList() {
    const winnerList = this.winnerList;
    const arenaId = this._id;

    const fighterList = dbArenaFighters
      .find({arenaId})
      .map((figher) => {
        if (winnerList.length) {
          figher.winnerIndex = _.indexOf(winnerList, figher.companyId) + 1;
        }
        else {
          figher.winnerIndex = '';
        }

        return figher;
      });
    const sortBy = rFighterSortBy.get();
    const sortDir = rFighterSortDir.get();

    return fighterList.sort((fighter1, fighter2) => {
      switch (sortBy) {
        case 'agi': {
          const agi1 = fighter1.agi;
          const agi2 = fighter2.agi;
          //agi相等時比較createdAt的逆序
          if (agi1 === agi2) {
            return (fighter1.createdAt.getTime() - fighter2.createdAt.getTime()) * sortDir * -1;
          }
          else {
            return (agi1 - agi2) * sortDir;
          }
        }
        default: {
          return (fighter1[sortBy] - fighter2[sortBy]) * sortDir;
        }
      }
    });
  },
  getAttributeNumber(fighter, attributeName) {
    return getAttributeNumber(attributeName, fighter[attributeName]);
  }
});
Template.arenaFighterTable.events({
  'click [data-sort]'(event) {
    const sortBy = $(event.currentTarget).attr('data-sort');
    if (rFighterSortBy.get() === sortBy) {
      rFighterSortDir.set(rFighterSortDir.get() * -1);
    }
    else {
      rFighterSortBy.set(sortBy);
      rFighterSortDir.set(-1);
    }
  }
});

const rLogOffset = new ReactiveVar(0);
const rCompanyId = new ReactiveVar('');
const rFighterIdList = new ReactiveVar([]);
const rFighterList = new ReactiveVar([]);
const rFilterResultList = new ReactiveVar([]);
inheritedShowLoadingOnSubscribing(Template.arenaLogList);
Template.arenaLogList.onCreated(function() {
  rLogOffset.set(0);
  this.autorun(() => {
    if (shouldStopSubscribe()) {
      return false;
    }
    const arenaId = FlowRouter.getParam('arenaId');
    if (arenaId) {
      this.subscribe('arenaLog', arenaId, rCompanyId.get(), rLogOffset.get());
    }
  });
  this.autorun(() => {
    const arenaId = FlowRouter.getParam('arenaId');
    const fighterIdList = dbArenaFighters.find({arenaId}).map((fighter) => {
      return fighter.companyId;
    });
    rFighterIdList.set(fighterIdList);
  });
  const ajaxList = [];
  this.autorun(() => {
    _.invoke(ajaxList, 'abort');
    ajaxList.splice(0);
    const fighterList = [];
    _.each(rFighterIdList.get(), (companyId, index) => {
      const ajaxResult = $.ajax({
        url: '/companyInfo',
        data: {
          id: companyId
        },
        dataType: 'json',
        success: (companyData) => {
          fighterList[index] = {
            _id: companyId,
            name: companyData.name
          };
        },
        error: () => {
          fighterList[index] = {
            _id: companyId,
            name: '???'
          };
        }
      });
      ajaxList.push(ajaxResult);
    });
    $.when(...ajaxList).always(() => {
      rFighterList.set(fighterList);
    });
  });
});
Template.arenaLogList.helpers({
  hasFilterResult() {
    return rFilterResultList.get().length > 0;
  },
  filterResultList() {
    return rFilterResultList.get();
  },
  logList() {
    const arenaId = FlowRouter.getParam('arenaId');
    window.dbArenaLog = dbArenaLog;

    return dbArenaLog
      .find({arenaId}, {
        sort: {
          sequence: 1
        },
        limit: 30
      })
      .map((log) => {
        log.attackerId = log.companyId[0];
        log.defenderId = log.companyId[1];

        return log;
      });
  },
  displaySp(log) {
    if (log.attackManner > 0) {
      return `(SP:${log.attackerSp})`;
    }
    else {
      const arenaId = log.arenaId;
      const companyId = log.attackerId;
      const attacker = dbArenaFighters.findOne({arenaId, companyId});

      return `(SP:${log.attackerSp}<span class="text-danger">-${attacker.spCost}</span>)`;
    }
  },
  displayAttackManaer(log) {
    let result = '';
    const arenaId = log.arenaId;
    const companyId = log.attackerId;
    const attacker = dbArenaFighters.findOne({arenaId, companyId});
    if (attacker) {
      if (log.attackManner > 0) {
        result += '普通攻擊';
        const mannerName = attacker.normalManner[log.attackManner - 1];
        if (mannerName) {
          result += '「' + mannerName + '」';
        }
      }
      else {
        result += '特殊攻擊';
        const mannerName = attacker.specialManner[(log.attackManner * -1) - 1];
        if (mannerName) {
          result += '「' + mannerName + '」';
        }
      }

      return result;
    }
    else {
      return '???';
    }
  },
  paginationData() {
    return {
      useVariableForTotalCount: 'totalCountOfArenaLog',
      dataNumberPerPage: 30,
      offset: rLogOffset
    };
  }
});
Template.arenaLogList.events({
  'focus [name="companyId"]': generateFilterResult,
  'keyup [name="companyId"]': generateFilterResult,
  'submit'(event) {
    event.preventDefault();
  },
  'click [data-filter]'(event, templateInstance) {
    event.preventDefault();
    const companyId = $(event.currentTarget).attr('data-filter');
    rFilterCompanyId.set(companyId);
    rLogOffset.set(0);
    rFilterResultList.set([]);
    const fighterData = _.find(rFighterList.get(), (fighter) => {
      return fighter._id === companyId;
    });
    if (fighterData) {
      templateInstance.$('[name="companyId"]').val(fighterData.name || '');
    }
  }
});

function generateFilterResult(event) {
  const searchName = $(event.currentTarget).val();
  if (searchName) {
    const searchRegExp = new RegExp(searchName);
    const filterResultList = _.filter(rFighterList.get(), (fighter) => {
      return searchRegExp.test(fighter.name);
    });
    rFilterResultList.set(filterResultList);
  }
  else {
    rFilterResultList.set([]);
  }
}
